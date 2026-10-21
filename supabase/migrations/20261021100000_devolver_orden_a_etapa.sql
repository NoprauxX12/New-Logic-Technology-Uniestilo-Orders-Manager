-- HU-18 · Devolver una orden a una etapa anterior, sin borrar nada.
--
-- Cuando el chequeo de calidad encuentra un defecto a mitad del flujo,
-- administración devuelve la orden a la etapa que debe rehacerse. La bitácora
-- no se reescribe (regla 3, RNF-05): lo que se marcó sigue ahí, con su quién y
-- su cuándo. Lo que cambia es que esos avances dejan de estar VIGENTES.
--
-- Piezas:
--   1. `reproceso`: el registro de la devolución (a qué etapa, por qué, quién,
--      cuándo). Solo se escribe desde la función de abajo.
--   2. `avance_seccion.anulado_por`: marca un avance como superado por un
--      reproceso. Es la ÚNICA transición permitida sobre un avance: de null a
--      un reproceso, una vez, hecha por `devolver_orden_a_etapa`. Un trigger
--      rechaza cualquier otro UPDATE y todo DELETE.
--   3. El índice único (orden, checkpoint) pasa a ser parcial sobre los
--      vigentes, para poder volver a marcar la etapa.
--   4. Todo lo que en la base lee avances (triggers, funciones, políticas)
--      ignora ahora los anulados.
--
-- Ver `docs/adr/0011`.

-- ---------------------------------------------------------------------------
-- 1. reproceso
-- ---------------------------------------------------------------------------

create table public.reproceso (
  id uuid primary key default gen_random_uuid(),

  orden_id uuid not null references public.orden (id),

  -- La etapa a la que volvió la orden: ella y todas las posteriores quedaron
  -- anuladas.
  checkpoint_destino public.checkpoint not null,

  motivo text not null,

  -- Quién lo hizo: sale de la sesión, nunca de un parámetro (regla 6).
  creado_por uuid not null default auth.uid() references public.usuario (id),
  creado_en timestamptz not null default now(),

  constraint reproceso_motivo_valido
    check (length(trim(motivo)) between 1 and 500)
);

create index reproceso_orden_id_idx on public.reproceso (orden_id);

comment on table public.reproceso is
  'HU-18: devoluciones de una orden a una etapa anterior. Inmutable: sin update ni delete, y sin insert directo (solo devolver_orden_a_etapa).';

alter table public.reproceso enable row level security;

create policy "lectura con sesion" on public.reproceso
  for select to authenticated using (public.rol_actual() is not null);

-- Sin política (ni permiso) de insert, update o delete para nadie: un reproceso
-- sin sus avances anulados sería una devolución falsa en el track. La única vía
-- de alta es la función SECURITY DEFINER de más abajo, que exige rol admin.
revoke all on public.reproceso from anon, authenticated;
grant select on public.reproceso to authenticated;

-- ---------------------------------------------------------------------------
-- 2. avance_seccion.anulado_por
-- ---------------------------------------------------------------------------

alter table public.avance_seccion
  add column anulado_por uuid references public.reproceso (id);

comment on column public.avance_seccion.anulado_por is
  'HU-18: el reproceso que dejó este avance sin vigencia. Null = vigente. La fila conserva su quién y cuándo originales.';

drop index public.avance_seccion_orden_checkpoint_idx;

-- Un checkpoint vigente se marca una sola vez por orden. Los anulados quedan
-- fuera: la misma etapa puede tener varios avances anulados y uno vigente.
create unique index avance_seccion_orden_checkpoint_idx
  on public.avance_seccion (orden_id, checkpoint)
  where anulado_por is null;

-- ---------------------------------------------------------------------------
-- 3. La bitácora sigue siendo inmutable
-- ---------------------------------------------------------------------------
-- `authenticated` no tiene permiso de update ni delete sobre la tabla; este
-- trigger es la segunda barrera y también ataja a quien corra como dueño.
-- La única excepción: pasar `anulado_por` de null a un reproceso de la MISMA
-- orden, sin tocar ningún otro dato, desde `devolver_orden_a_etapa` (que
-- levanta la bandera `uniestilo.devolviendo` solo durante su transacción).

create function public.proteger_bitacora_de_avances()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'La bitácora de avances no se borra'
      using errcode = 'UE014';
  end if;

  if coalesce(current_setting('uniestilo.devolviendo', true), '') <> 'on'
     or old.anulado_por is not null
     or new.anulado_por is null
     or new.id is distinct from old.id
     or new.orden_id is distinct from old.orden_id
     or new.checkpoint is distinct from old.checkpoint
     or new.usuario_id is distinct from old.usuario_id
     or new.fecha_hora is distinct from old.fecha_hora
     or new.observaciones is distinct from old.observaciones
     or not exists (
       select 1
       from public.reproceso r
       where r.id = new.anulado_por
         and r.orden_id = old.orden_id
     ) then
    raise exception 'La bitácora de avances no se edita: un error se corrige con un registro nuevo'
      using errcode = 'UE014';
  end if;

  return new;
end;
$$;

comment on function public.proteger_bitacora_de_avances is
  'RNF-05: rechaza todo UPDATE/DELETE de avance_seccion, salvo marcar un avance como anulado por un reproceso (HU-18).';

create trigger avance_seccion_bitacora_inmutable
  before update or delete on public.avance_seccion
  for each row
  execute function public.proteger_bitacora_de_avances();

-- Local reparte privilegios por defecto a `authenticated`: se le quitan el
-- update, el delete y el truncate de la bitácora para que tampoco dependa de
-- que no haya política (RNF-05). El insert se conserva.
revoke update, delete, truncate on public.avance_seccion from anon, authenticated;

-- Nadie puede insertar un avance ya anulado: la política de alta lo exige
-- (se recrea igual que en 20261005120000, más `anulado_por is null`).
drop policy "cada rol marca su checkpoint" on public.avance_seccion;

create policy "cada rol marca su checkpoint" on public.avance_seccion
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and anulado_por is null
    and public.rol_actual() = public.rol_dueno(checkpoint)
  );

-- ---------------------------------------------------------------------------
-- 4. Lo que lee avances ignora los anulados
-- ---------------------------------------------------------------------------

-- HU-13: una orden completada no admite más avances. (Una cerrada nunca se
-- anula, porque no se devuelve; el filtro mantiene la regla uniforme.)
create or replace function public.impedir_avance_en_orden_cerrada()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.avance_seccion
    where orden_id = new.orden_id
      and checkpoint = 'cerrada'
      and anulado_por is null
  ) then
    raise exception 'La orden ya está completada y no admite más cambios'
      using errcode = 'UE004';
  end if;

  return new;
end;
$$;

-- HU-09/HU-10: no se despacha un lote sin el recogido y bordado vigente.
create or replace function public.exigir_recogido_para_despachar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.avance_seccion
    where orden_id = new.orden_id
      and checkpoint = 'recogido_bordado'
      and anulado_por is null
  ) then
    raise exception 'La orden todavía no tiene el recogido y bordado'
      using errcode = 'UE001';
  end if;

  return new;
end;
$$;

-- HU-05: secretaría solo edita la tela mientras la etapa no esté vigente.
drop policy "secretaria programa tela" on public.item_orden;

create policy "secretaria programa tela"
on public.item_orden
for update to authenticated
using (
  public.rol_actual() = 'secretaria'
  and not exists (
    select 1
    from public.avance_seccion a
    where a.orden_id = item_orden.orden_id
      and a.checkpoint in ('tela_programada', 'corte_completado', 'cerrada')
      and a.anulado_por is null
  )
)
with check (public.rol_actual() = 'secretaria');

-- HU-05: mismo cuerpo que en 20261018122000; solo cambian las dos lecturas de
-- avances, que ahora cuentan únicamente los vigentes.
create or replace function public.programar_tela(
  p_orden_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_actualizados integer;
begin
  if auth.uid() is null
     or public.rol_actual() is distinct from 'secretaria'::public.rol then
    raise exception 'Solo secretaría puede programar la tela';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_orden_id::text, 0)
  );

  if not exists (
    select 1 from public.orden where id = p_orden_id
  ) then
    raise exception 'La orden indicada no existe';
  end if;

  if not exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint = 'ficha_adjunta'
      and anulado_por is null
  ) then
    raise exception 'Primero debe estar marcada la ficha técnica';
  end if;

  if exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint in ('tela_programada', 'corte_completado', 'cerrada')
      and anulado_por is null
  ) then
    raise exception 'Esta orden ya no admite programar tela';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Los datos de las prendas no son válidos';
  end if;

  select count(*) into v_total
  from public.item_orden
  where orden_id = p_orden_id;

  if v_total = 0 or jsonb_array_length(p_items) <> v_total then
    raise exception 'Debes completar todas las prendas de la orden';
  end if;

  if (
    select count(distinct x.item_id)
    from jsonb_to_recordset(p_items) as x(item_id uuid)
  ) <> v_total then
    raise exception 'Hay prendas repetidas o sin identificar';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(
      item_id uuid,
      tipo_tela text,
      cantidad_tela numeric,
      unidad_tela text,
      observaciones_tela text
    )
    where not exists (
      select 1 from public.item_orden i
      where i.id = x.item_id and i.orden_id = p_orden_id
    )
      or x.tipo_tela is null
      or length(trim(x.tipo_tela)) not between 1 and 200
      or x.cantidad_tela is null
      or not (x.cantidad_tela > 0 and x.cantidad_tela <= 99999999.99)
      or x.cantidad_tela <> round(x.cantidad_tela, 2)
      or x.unidad_tela is null
      or x.unidad_tela not in ('metros', 'kilos')
      or length(coalesce(x.observaciones_tela, '')) > 1000
  ) then
    raise exception 'Revisa los datos de tela de cada prenda';
  end if;

  update public.item_orden i
  set
    tipo_tela = trim(x.tipo_tela),
    cantidad_tela = x.cantidad_tela,
    unidad_tela = x.unidad_tela,
    observaciones_tela = nullif(trim(x.observaciones_tela), '')
  from jsonb_to_recordset(p_items) as x(
    item_id uuid,
    tipo_tela text,
    cantidad_tela numeric,
    unidad_tela text,
    observaciones_tela text
  )
  where i.id = x.item_id and i.orden_id = p_orden_id;

  get diagnostics v_actualizados = row_count;

  if v_actualizados <> v_total then
    raise exception 'No se pudieron guardar todas las prendas';
  end if;

  insert into public.avance_seccion (
    orden_id, checkpoint, usuario_id
  )
  values (
    p_orden_id, 'tela_programada', auth.uid()
  );
end;
$$;

-- HU-20 (`generar_alertas_proximidad_entrega`) también ignora los anulados; se
-- redefine en la migración siguiente, junto con la etapa inicial.

-- ---------------------------------------------------------------------------
-- 5. devolver_orden_a_etapa
-- ---------------------------------------------------------------------------
-- Regla de destino: tiene que ser una etapa que la orden tiene VIGENTE (marcada
-- y sin anular). Se anulan esa etapa y todas las vigentes que la siguen en el
-- flujo (el orden del enum es el del flujo). Devolver "a la última marcada" es
-- válido: es rehacer solo esa etapa. No se puede devolver una orden cerrada
-- (para eso está la orden de corrección) ni a una etapa que no está marcada.
--
-- SECURITY DEFINER porque `authenticated` no tiene permiso de update sobre
-- `avance_seccion` ni de insert sobre `reproceso`, a propósito. Por eso hace
-- ella misma lo que haría RLS: exige sesión y rol admin. `search_path` vacío.
-- Quién devuelve sale de `auth.uid()` (default de `reproceso.creado_por`).
--
-- Si el destino es la programación a diseño o una etapa anterior, la hoja y el
-- turno de la orden (`numero_orden_programacion`, `posicion_programacion`)
-- quedan libres para que secretaría pueda programarla de nuevo; el dato
-- histórico de la hoja sigue en la observación del avance anulado.

create function public.devolver_orden_a_etapa(
  p_orden_id uuid,
  p_checkpoint_destino public.checkpoint,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_motivo text := trim(coalesce(p_motivo, ''));
  v_reproceso uuid;
begin
  if v_usuario is null then
    raise exception 'No hay una sesión activa'
      using errcode = 'UE006';
  end if;

  if public.rol_actual() is distinct from 'admin'::public.rol then
    raise exception 'Devolver una orden a una etapa lo hace administración'
      using errcode = 'UE007';
  end if;

  if length(v_motivo) not between 1 and 500 then
    raise exception 'Escribe el motivo de la devolución (máximo 500 letras)'
      using errcode = 'UE010';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_orden_id::text, 0)
  );

  if not exists (select 1 from public.orden where id = p_orden_id) then
    raise exception 'La orden indicada no existe'
      using errcode = 'UE005';
  end if;

  if exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint = 'cerrada'
      and anulado_por is null
  ) then
    raise exception 'La orden ya está completada: para un defecto se crea una orden de corrección'
      using errcode = 'UE004';
  end if;

  if not exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint = p_checkpoint_destino
      and anulado_por is null
  ) then
    raise exception 'La orden no tiene marcada esa etapa, así que no se puede devolver a ella'
      using errcode = 'UE011';
  end if;

  insert into public.reproceso (orden_id, checkpoint_destino, motivo)
  values (p_orden_id, p_checkpoint_destino, v_motivo)
  returning id into v_reproceso;

  -- Bandera que el trigger de la bitácora exige para dejar pasar el único
  -- cambio permitido; `true` la limita a esta transacción.
  perform pg_catalog.set_config('uniestilo.devolviendo', 'on', true);

  update public.avance_seccion
  set anulado_por = v_reproceso
  where orden_id = p_orden_id
    and anulado_por is null
    and checkpoint >= p_checkpoint_destino;

  perform pg_catalog.set_config('uniestilo.devolviendo', 'off', true);

  if p_checkpoint_destino <= 'programada_diseno' then
    update public.orden
    set numero_orden_programacion = null,
        posicion_programacion = null
    where id = p_orden_id;
  end if;

  return v_reproceso;
end;
$$;

comment on function public.devolver_orden_a_etapa is
  'HU-18: devuelve una orden no cerrada a una etapa vigente. Registra el reproceso y anula (sin borrar) los avances de esa etapa en adelante. Solo administración.';

revoke execute on function public.devolver_orden_a_etapa(uuid, public.checkpoint, text)
  from public, anon;

grant execute on function public.devolver_orden_a_etapa(uuid, public.checkpoint, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Tiempo real
-- ---------------------------------------------------------------------------
-- El tablero escucha el INSERT de `reproceso` para refrescarse al devolver una
-- orden (el UPDATE de `anulado_por` llega junto con él).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'reproceso'
     ) then
    alter publication supabase_realtime add table public.reproceso;
  end if;
end $$;
