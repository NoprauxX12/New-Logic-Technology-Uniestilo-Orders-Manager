-- HU-05: datos de tela digitados por secretaría para cada ítem.
alter table public.item_orden
  add column tipo_tela text,
  add column unidad_tela text,
  add column observaciones_tela text;

alter table public.item_orden
  add constraint item_orden_tipo_tela_no_vacio
    check (tipo_tela is null or length(trim(tipo_tela)) > 0),
  add constraint item_orden_unidad_tela_valida
    check (unidad_tela is null or unidad_tela in ('metros', 'kilos'));

-- Solo secretaría puede actualizar los campos de tela.
grant update (
  tipo_tela,
  cantidad_tela,
  unidad_tela,
  observaciones_tela
) on public.item_orden to authenticated;

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
  )
)
with check (public.rol_actual() = 'secretaria');

-- Guarda todos los ítems y el avance, o revierte todo si algo falla.
create function public.programar_tela(
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

  -- Evita dos programaciones simultáneas de la misma orden.
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
  ) then
    raise exception 'Primero debe estar marcada la ficha técnica';
  end if;

  if exists (
    select 1
    from public.avance_seccion
    where orden_id = p_orden_id
      and checkpoint in ('tela_programada', 'corte_completado', 'cerrada')
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

revoke execute on function public.programar_tela(uuid, jsonb)
  from public, anon;

grant execute on function public.programar_tela(uuid, jsonb)
  to authenticated;
