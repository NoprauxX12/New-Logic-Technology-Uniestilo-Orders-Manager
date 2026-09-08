-- HU-08 · Marcar corte como completado.
-- Registra los avances de una orden sin guardar una columna de estado.
-- El estado actual se obtiene consultando las etapas que ya fueron marcadas.

create table public.avance_seccion (
  id uuid primary key default gen_random_uuid(),

  orden_id uuid not null
    references public.orden (id),

  seccion text not null,

  -- Se completa cuando exista autenticación. Mientras no haya una sesión,
  -- auth.uid() devuelve null.
  usuario_id uuid
    references auth.users (id),

  fecha_hora timestamptz not null default now(),

  constraint avance_seccion_seccion_valida
    check (
      seccion in (
        'corte_completado',
        'llegada_marcacion',
        'lista_despacho',
        'cerrada'
      )
    ),

  -- Una misma etapa no puede marcarse dos veces para la misma orden.
  constraint avance_seccion_orden_seccion_unica
    unique (orden_id, seccion)
);

create index avance_seccion_orden_id_idx
  on public.avance_seccion (orden_id);

-- Seguridad a nivel de fila.
alter table public.avance_seccion enable row level security;

-- Políticas temporales mientras se implementan el login y los roles.
create policy "temporal HU-17: avance lectura abierta"
  on public.avance_seccion
  for select
  to anon, authenticated
  using (true);

create policy "temporal HU-17: avance alta abierta"
  on public.avance_seccion
  for insert
  to anon, authenticated
  with check (true);

-- No se crean políticas de actualización ni eliminación porque el historial
-- de avances debe ser inmutable.

grant select, insert
  on public.avance_seccion
  to anon, authenticated;

-- Punto de entrada del workflow para HU-08.
create or replace function public.marcar_corte_completado(
  p_orden_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_avance_id uuid;
begin
  -- La orden debe existir.
  if not exists (
    select 1
    from public.orden
    where id = p_orden_id
  ) then
    raise exception 'La orden indicada no existe';
  end if;

  -- La restricción única también protege contra dos solicitudes simultáneas.
  insert into public.avance_seccion (
    orden_id,
    seccion,
    usuario_id
  )
  values (
    p_orden_id,
    'corte_completado',
    auth.uid()
  )
  returning id into v_avance_id;

  return v_avance_id;
end;
$$;

comment on table public.avance_seccion is
  'Historial inmutable de las etapas completadas por cada orden.';

comment on function public.marcar_corte_completado is
  'HU-08: registra que la etapa de corte fue completada para una orden.';

grant execute
  on function public.marcar_corte_completado(uuid)
  to anon, authenticated;
