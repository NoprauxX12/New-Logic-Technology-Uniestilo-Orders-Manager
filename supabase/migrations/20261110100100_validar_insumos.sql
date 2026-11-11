-- HU-23 · Validar los insumos de la orden.
--
-- Secretaría saca, según la orden de compra, el listado de insumos que lleva la
-- orden (cuáles y cuántos) y lo da por validado. Sin alerta: los insumos se
-- consiguen en un día, así que no frenan nada más que su propia etapa.
--
-- Piezas:
--   1. `rol_dueno`: secretaría es la dueña de `insumos_validados`.
--   2. `insumo_orden`: el listado. Cada fila apunta al avance que lo validó, y
--      es inmutable: una devolución (HU-18) anula el avance y el listado se
--      vuelve a validar con filas nuevas, sin tocar las viejas (RNF-05).
--   3. Un avance `insumos_validados` sin listado no se puede guardar.
--   4. `validar_insumos`: guarda el listado y marca la etapa en una sola
--      transacción (ADR 0005).
--   5. HU-20 nombra el área nueva en sus avisos.
--
-- Ver `docs/adr/0012`.

-- ---------------------------------------------------------------------------
-- 1. Secretaría es la dueña de "insumos validados"
-- ---------------------------------------------------------------------------
-- Copia de `CHECKPOINTS` en `src/features/workflow/checkpoints.ts`: el único
-- cambio respecto de la versión de `20261019110100_secretaria_marca_cotizacion_enviada.sql`
-- es `insumos_validados`. `rlsPorRol.test.ts` verifica que las dos copias digan
-- lo mismo.

create or replace function public.rol_dueno(p_checkpoint public.checkpoint)
returns public.rol
language sql
immutable
set search_path = ''
as $$
  select case p_checkpoint
    when 'cotizacion_enviada'  then 'secretaria'
    when 'cotizacion_aprobada' then 'secretaria'
    when 'programada_diseno'   then 'secretaria'
    when 'ficha_adjunta'       then 'diseno'
    when 'tela_programada'     then 'secretaria'
    when 'insumos_validados'   then 'secretaria'
    when 'corte_completado'    then 'corte'
    when 'recogido_bordado'    then 'logistica'
    when 'llegada_marcacion'   then 'marcacion'
    when 'lista_despacho'      then 'terminacion'
    when 'etiquetas'           then 'secretaria'
    when 'documentos_despacho' then 'secretaria'
    when 'factura_generada'    then 'secretaria'
    when 'cerrada'             then 'secretaria'
  end::public.rol
$$;

comment on function public.rol_dueno is
  'HU-17: el rol que puede marcar cada checkpoint. Copia de checkpoints.ts verificada por test.';

-- ---------------------------------------------------------------------------
-- 2. El listado de insumos
-- ---------------------------------------------------------------------------
-- Los siete insumos que nombra la historia. Copia de `INSUMOS` en
-- `src/features/insumos/catalogo.ts`; `catalogo.test.ts` verifica que digan lo
-- mismo.

create type public.tipo_insumo as enum (
  'hilo',
  'resorte',
  'cierre',
  'boton',
  'hilo_bordar',
  'sublimado',
  'estampado'
);

create table public.insumo_orden (
  id uuid primary key default gen_random_uuid(),

  orden_id uuid not null references public.orden (id),

  -- El avance `insumos_validados` que dio por bueno este listado. Quién y
  -- cuándo salen de ahí: no se repiten en la fila.
  avance_id uuid not null references public.avance_seccion (id),

  insumo public.tipo_insumo not null,

  -- Cuánto y cómo, en palabras del taller: "200 botones blancos de 4 huecos".
  detalle text not null,

  constraint insumo_orden_detalle_valido
    check (length(trim(detalle)) between 1 and 300),

  -- Un insumo aparece una sola vez en cada validación.
  constraint insumo_orden_uno_por_validacion unique (avance_id, insumo)
);

create index insumo_orden_orden_id_idx on public.insumo_orden (orden_id);

comment on table public.insumo_orden is
  'HU-23: los insumos que secretaría validó para una orden. Inmutable; solo se escribe con validar_insumos.';

alter table public.insumo_orden enable row level security;

-- Lo leen quien valida y administración, que ve todo.
create policy "secretaria y admin leen insumos" on public.insumo_orden
  for select to authenticated
  using (public.rol_actual() in ('secretaria', 'admin'));

-- Solo dentro de la misma transacción que marcó la etapa: el avance tiene que
-- ser el `insumos_validados` vigente de esa orden, firmado por quien inserta y
-- con la hora de esta transacción (`poner_hora_del_servidor` le pone `now()`).
-- Así nadie agrega un insumo después a una validación ya hecha, ni siquiera
-- secretaría con una llamada directa a la API.
create policy "secretaria valida insumos" on public.insumo_orden
  for insert to authenticated
  with check (
    public.rol_actual() = 'secretaria'
    and exists (
      select 1
      from public.avance_seccion a
      where a.id = insumo_orden.avance_id
        and a.orden_id = insumo_orden.orden_id
        and a.checkpoint = 'insumos_validados'
        and a.anulado_por is null
        and a.usuario_id = (select auth.uid())
        and a.fecha_hora = pg_catalog.now()
    )
  );

-- Sin update ni delete para nadie: el listado validado es parte de la bitácora.
revoke all on public.insumo_orden from anon, authenticated;
grant select, insert on public.insumo_orden to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Un avance "insumos validados" trae su listado
-- ---------------------------------------------------------------------------
-- La etapa se puede insertar con la acción genérica del motor o con una
-- llamada directa, y validada sin listado no dice nada. El chequeo es diferido:
-- el avance se inserta primero (las filas del listado apuntan a él) y al
-- confirmar la transacción ya tiene que tener al menos un insumo.

create function public.exigir_listado_de_insumos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.insumo_orden i where i.avance_id = new.id
  ) then
    raise exception 'Los insumos se validan con su listado: usa la pantalla de insumos'
      using errcode = 'UE016';
  end if;

  return null;
end;
$$;

comment on function public.exigir_listado_de_insumos is
  'HU-23: un avance insumos_validados sin ningún insumo no se confirma.';

revoke execute on function public.exigir_listado_de_insumos()
  from public, anon, authenticated;

create constraint trigger avance_insumos_trae_listado
  after insert on public.avance_seccion
  deferrable initially deferred
  for each row
  when (new.checkpoint = 'insumos_validados')
  execute function public.exigir_listado_de_insumos();

-- ---------------------------------------------------------------------------
-- 4. validar_insumos
-- ---------------------------------------------------------------------------
-- Recibe el listado como `[{ "insumo": "boton", "detalle": "200 blancos" }]`.
-- SECURITY INVOKER (ADR 0005): las políticas de `avance_seccion` y de
-- `insumo_orden` aplican igual que a una llamada directa. Quién valida sale de
-- `auth.uid()`, nunca de un parámetro (regla 6).
--
-- La secuencia la decide el motor de workflow antes de llamar (regla 2); aquí
-- se repite lo mínimo para que la base no quede incoherente: la tela vigente,
-- que no haya otra validación vigente y que la orden siga abierta.

create function public.validar_insumos(
  p_orden_id uuid,
  p_insumos jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_avance_id uuid;
  v_insertados integer;
begin
  if auth.uid() is null
     or public.rol_actual() is distinct from 'secretaria'::public.rol then
    raise exception 'Solo secretaría puede validar los insumos';
  end if;

  -- Evita dos validaciones simultáneas de la misma orden.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_orden_id::text, 0)
  );

  if not exists (select 1 from public.orden where id = p_orden_id) then
    raise exception 'La orden indicada no existe';
  end if;

  if not exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint = 'tela_programada'
      and anulado_por is null
  ) then
    raise exception 'Primero debe estar programada la tela';
  end if;

  if exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint in ('insumos_validados', 'cerrada')
      and anulado_por is null
  ) then
    raise exception 'Los insumos de esta orden ya están validados';
  end if;

  if p_insumos is null
     or jsonb_typeof(p_insumos) <> 'array'
     or jsonb_array_length(p_insumos) = 0 then
    raise exception 'Marca al menos un insumo';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_insumos) as x(valor)
    where jsonb_typeof(x.valor) <> 'object'
      or jsonb_typeof(x.valor -> 'insumo') is distinct from 'string'
      or jsonb_typeof(x.valor -> 'detalle') is distinct from 'string'
      or (x.valor ->> 'insumo') not in (
        select e::text from unnest(enum_range(null::public.tipo_insumo)) as e
      )
      or length(trim(x.valor ->> 'detalle')) not between 1 and 300
  ) then
    raise exception 'Revisa los insumos: cada uno lleva cuánto y cómo';
  end if;

  if (
    select count(distinct x.valor ->> 'insumo')
    from jsonb_array_elements(p_insumos) as x(valor)
  ) <> jsonb_array_length(p_insumos) then
    raise exception 'Un insumo está dos veces en el listado';
  end if;

  insert into public.avance_seccion (orden_id, checkpoint, usuario_id)
  values (p_orden_id, 'insumos_validados', auth.uid())
  returning id into v_avance_id;

  insert into public.insumo_orden (orden_id, avance_id, insumo, detalle)
  select
    p_orden_id,
    v_avance_id,
    (x.valor ->> 'insumo')::public.tipo_insumo,
    trim(x.valor ->> 'detalle')
  from jsonb_array_elements(p_insumos) as x(valor);

  get diagnostics v_insertados = row_count;

  if v_insertados <> jsonb_array_length(p_insumos) then
    raise exception 'No se pudo guardar todo el listado';
  end if;
end;
$$;

comment on function public.validar_insumos is
  'HU-23: guarda el listado de insumos de una orden y marca insumos_validados, todo o nada. Solo secretaría.';

revoke execute on function public.validar_insumos(uuid, jsonb)
  from public, anon;

grant execute on function public.validar_insumos(uuid, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. HU-20 nombra la etapa nueva
-- ---------------------------------------------------------------------------
-- Mismo cuerpo que en `20261021100100_orden_de_correccion.sql`; solo se agrega
-- el área de `insumos_validados` a los avisos de entrega.

create or replace function public.generar_alertas_proximidad_entrega(
  p_dias integer default 3
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_creadas integer;
begin
  with candidatas as (
    select
      o.id as orden_id,
      o.numero_orden_compra,
      o.fecha_entrega,
      c.razon_social,
      (o.fecha_entrega - v_hoy) as dias,
      siguiente.etapa,
      exists (
        select 1
        from public.lote_taller l
        where l.orden_id = o.id
          and l.recibido_completo is null
      ) as en_taller
    from public.orden o
    join public.cliente c on c.id = o.cliente_id
    cross join lateral (
      select max(a.checkpoint) as ultimo
      from public.avance_seccion a
      where a.orden_id = o.id
        and a.anulado_por is null
    ) as avanzado
    cross join lateral (
      select e as etapa
      from unnest(enum_range(null::public.checkpoint)) as e
      where (avanzado.ultimo is null or e > avanzado.ultimo)
        and (o.etapa_inicial is null or e >= o.etapa_inicial)
      order by e
      limit 1
    ) as siguiente
    where (o.fecha_entrega - v_hoy) <= p_dias
      and not exists (
        select 1
        from public.avance_seccion a
        where a.orden_id = o.id
          and a.checkpoint = 'cerrada'
          and a.anulado_por is null
      )
  ),
  con_area as (
    select
      cand.*,
      case
        when cand.en_taller then 'el taller'
        else case cand.etapa::text
          when 'cotizacion_enviada'  then 'Cotización'
          when 'cotizacion_aprobada' then 'Cotización'
          when 'programada_diseno'   then 'Programación a diseño'
          when 'ficha_adjunta'       then 'Diseño'
          when 'tela_programada'     then 'Programación de tela'
          when 'insumos_validados'   then 'Validación de insumos'
          when 'corte_completado'    then 'Corte'
          when 'recogido_bordado'    then 'Recogido y bordado'
          when 'llegada_marcacion'   then 'Marcación'
          when 'lista_despacho'      then 'Terminación'
          else 'el cierre de la orden'
        end
      end as area
    from candidatas cand
  ),
  destinatarios as (
    select a.orden_id, u.id as usuario_id
    from con_area a
    join public.usuario u
      on u.activo
     and (
       u.rol = 'admin'
       or u.rol = public.rol_dueno(a.etapa)
       or (a.en_taller and u.rol = 'logistica')
     )
  ),
  nuevas as (
    insert into public.alerta (tipo, orden_id, destinatario_id, creada_por, detalle)
    select
      'proximidad_entrega',
      a.orden_id,
      d.usuario_id,
      null,
      'La orden ' || a.numero_orden_compra || ' de ' || a.razon_social || ' '
        || case
             when a.dias < 0 then
               'se venció hace ' || (-a.dias)
                 || case when a.dias = -1 then ' día' else ' días' end
             when a.dias = 0 then 'entrega hoy'
             when a.dias = 1 then 'entrega mañana'
             else 'entrega en ' || a.dias || ' días'
           end
        || case
             when a.dias = 0 then ''
             else ' (' || to_char(a.fecha_entrega, 'DD/MM') || ')'
           end
        || ' y está en ' || a.area
    from con_area a
    join destinatarios d on d.orden_id = a.orden_id
    on conflict (orden_id, destinatario_id) where tipo = 'proximidad_entrega'
    do nothing
    returning 1
  )
  select count(*) into v_creadas from nuevas;

  return v_creadas;
end;
$$;

revoke execute on function public.generar_alertas_proximidad_entrega(integer)
  from public, anon, authenticated, service_role;
