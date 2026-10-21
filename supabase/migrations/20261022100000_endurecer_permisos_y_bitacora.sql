-- Endurecer permisos y bitácora.
--
-- Las pruebas pgTAP de la base (supabase/tests) encontraron nueve huecos reales
-- en lo ya construido. Ninguno lo explotaba la interfaz, pero toda la seguridad
-- está en la base (RNF-04) porque una Server Action o la API REST se pueden
-- invocar con una petición directa. Esta migración los cierra; cada bloque dice
-- qué prueba lo cubre.

-- ---------------------------------------------------------------------------
-- 1. item_orden: solo se actualizan las columnas de la tela
-- ---------------------------------------------------------------------------
-- HU-05 concedió `update (columnas de tela)`, pero la tabla ya tenía UPDATE
-- completo por los permisos por defecto de Supabase, así que secretaría podía
-- cambiar valor, cantidad o descripción de cualquier prenda. Se hace como con
-- `orden` y `alerta`: primero se quita todo y luego se concede lo que se usa.

revoke update on public.item_orden from authenticated;

grant update (tipo_tela, cantidad_tela, unidad_tela, observaciones_tela)
  on public.item_orden to authenticated;

-- ---------------------------------------------------------------------------
-- 2. lote_taller: un lote recibido no se reescribe
-- ---------------------------------------------------------------------------
-- La política de recepción solo pedía `recibido_por = auth.uid()` y la tabla
-- tenía UPDATE completo: otra persona de logística podía reescribir un lote ya
-- recibido e incluso cambiar quién lo había enviado. Ahora solo se actualizan
-- las columnas de la recepción y solo mientras el lote sigue en el taller.

revoke update on public.lote_taller from authenticated;

grant update (
  recibido_completo, fecha_recepcion, recibido_por, observaciones_recepcion
) on public.lote_taller to authenticated;

alter policy "logistica recibe" on public.lote_taller
  using (
    public.rol_actual() = 'logistica'
    and recibido_completo is null
  );

-- ---------------------------------------------------------------------------
-- 3. alerta: una cuenta desactivada no lee ni atiende, y lo atendido no se reabre
-- ---------------------------------------------------------------------------
-- Las políticas del destinatario no pasaban por `rol_actual()`, que devuelve
-- null para una cuenta inactiva (regla de Supabase del proyecto: quien se
-- desactiva queda sin acceso a todo). Y la de actualizar no miraba el estado,
-- así que el destinatario podía volver a dejar pendiente una alerta atendida o
-- reescribir su fecha de atención.

alter policy "alerta propia o admin" on public.alerta
  using (
    public.rol_actual() is not null
    and (
      destinatario_id = (select auth.uid())
      or public.rol_actual() = 'admin'
    )
  );

alter policy "el destinatario atiende su alerta" on public.alerta
  using (
    public.rol_actual() is not null
    and destinatario_id = (select auth.uid())
    and estado = 'pendiente'
  )
  with check (
    public.rol_actual() is not null
    and destinatario_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Las horas las pone el servidor
-- ---------------------------------------------------------------------------
-- `fecha_hora` de un avance (y la de envío del lote y la de subida de la ficha)
-- las llenaba quien insertaba: con un JWT y una llamada directa se podía marcar
-- una etapa con fecha de hace 30 días, y la bitácora existe para decir cuándo
-- pasó de verdad (RNF-05). Con sesión, la hora siempre es la del servidor. Sin
-- sesión (el seed, mantenimiento con el dueño de la base) se respeta la que
-- venga, para poder cargar historia de ejemplo.

create or replace function public.poner_hora_del_servidor()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new := jsonb_populate_record(
      new,
      jsonb_build_object(tg_argv[0], pg_catalog.now())
    );
  end if;

  return new;
end;
$$;

comment on function public.poner_hora_del_servidor is
  'RNF-05: con sesión, la columna de fecha que recibe como argumento siempre es la hora del servidor.';

create trigger avance_seccion_hora_del_servidor
  before insert on public.avance_seccion
  for each row
  execute function public.poner_hora_del_servidor('fecha_hora');

create trigger lote_taller_hora_del_servidor
  before insert on public.lote_taller
  for each row
  execute function public.poner_hora_del_servidor('fecha_envio');

create trigger ficha_tecnica_hora_del_servidor
  before insert on public.ficha_tecnica
  for each row
  execute function public.poner_hora_del_servidor('fecha_subida');

-- La recepción del lote también se fecha con la hora del servidor, al pasar de
-- "en el taller" a "recibido".
create or replace function public.fechar_recepcion_de_lote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and old.recibido_completo is null
     and new.recibido_completo is not null then
    new.fecha_recepcion := pg_catalog.now();
  end if;

  return new;
end;
$$;

comment on function public.fechar_recepcion_de_lote is
  'RNF-05: la hora de recepción de un lote la pone el servidor, no el navegador.';

create trigger lote_taller_fecha_de_recepcion
  before update on public.lote_taller
  for each row
  execute function public.fechar_recepcion_de_lote();

-- ---------------------------------------------------------------------------
-- 5. Factura: ni en blanco, ni se cambia una vez escrita, ni con la orden cerrada
-- ---------------------------------------------------------------------------
-- Solo el avance estaba congelado: el número de factura de una orden cerrada se
-- podía cambiar con un UPDATE directo, y `reportar_factura` aceptaba un número
-- en blanco.

alter table public.orden
  add constraint orden_numero_factura_no_vacio
    check (numero_factura is null or length(trim(numero_factura)) > 0);

create or replace function public.proteger_numero_de_factura()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.numero_factura is not distinct from old.numero_factura then
    return new;
  end if;

  -- Una factura ya escrita no se cambia: un error se corrige con una orden de
  -- corrección (HU-18), no reescribiendo.
  if old.numero_factura is not null then
    raise exception 'El número de factura ya quedó registrado y no se cambia'
      using errcode = 'UE015';
  end if;

  -- Y con la orden cerrada tampoco se escribe uno nuevo.
  if exists (
    select 1
    from public.avance_seccion
    where orden_id = new.id
      and checkpoint = 'cerrada'
      and anulado_por is null
  ) then
    raise exception 'La orden está cerrada y su factura ya no se modifica'
      using errcode = 'UE004';
  end if;

  return new;
end;
$$;

comment on function public.proteger_numero_de_factura is
  'HU-13: el número de factura no se cambia una vez escrito ni con la orden cerrada.';

create trigger orden_protege_numero_de_factura
  before update of numero_factura on public.orden
  for each row
  execute function public.proteger_numero_de_factura();

-- ---------------------------------------------------------------------------
-- 6. Permisos de sobra
-- ---------------------------------------------------------------------------
-- Las funciones de trigger no se llaman a mano, pero PUBLIC conserva EXECUTE por
-- defecto en toda función nueva: se quita, igual que en el resto del proyecto.
-- Disparar un trigger no exige EXECUTE al usuario, solo crearlo.
revoke execute on function
  public.impedir_avance_en_orden_cerrada(),
  public.exigir_tela_para_cortar(),
  public.proteger_llegada_de_tela(),
  public.exigir_recogido_para_despachar(),
  public.proteger_bitacora_de_avances(),
  public.poner_hora_del_servidor(),
  public.fechar_recepcion_de_lote(),
  public.proteger_numero_de_factura()
from public, anon, authenticated;

-- `authenticated` conserva TRUNCATE sobre las tablas (Supabase lo concede por
-- defecto). RLS no lo frena y vaciaría la tabla entera si algún día PostgREST
-- lo expusiera; ningún flujo de la aplicación lo necesita.
revoke truncate on all tables in schema public from authenticated, anon;

alter default privileges in schema public
  revoke truncate on tables from authenticated, anon;
