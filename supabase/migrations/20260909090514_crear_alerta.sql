-- Base de avances · Alertas persistentes (HU-06, HU-07 y HU-20, Sprint 2 y 3).
--
-- Regla 7: una alerta es una fila con destinatario y estado, no una
-- notificación que aparece y se pierde. Se crea, alguien la ve en el tablero y
-- alguien la marca atendida, y queda el rastro de las tres cosas.
--
-- Se crea desde ya, con el resto del modelo, para que quien tome HU-06 o HU-07
-- no tenga que diseñarla. Quien las implemente probablemente le agregue algo:
-- eso es una migración de ajuste, no un error de esta.

create type public.tipo_alerta as enum (
  'falta_tela',           -- HU-06
  'proximidad_entrega'    -- HU-20
);

create type public.estado_alerta as enum (
  'pendiente',
  'atendida'
);

create table public.alerta (
  id uuid primary key default gen_random_uuid(),

  tipo public.tipo_alerta not null,
  orden_id uuid not null references public.orden (id),

  -- A quién le toca resolverla. Se guarda la persona, no el rol, para que la
  -- alerta siga teniendo dueño aunque después cambien los roles.
  destinatario_id uuid not null references public.usuario (id),

  detalle text not null,

  estado public.estado_alerta not null default 'pendiente',
  fecha_creacion timestamptz not null default now(),
  fecha_atencion timestamptz,

  -- Una alerta atendida tiene fecha de atención, y una pendiente no. Sin esto
  -- se puede quedar en un estado que no significa nada.
  constraint alerta_atencion_coherente check (
    (estado = 'pendiente' and fecha_atencion is null)
    or
    (estado = 'atendida' and fecha_atencion is not null)
  ),

  constraint alerta_atencion_no_anterior check (
    fecha_atencion is null or fecha_atencion >= fecha_creacion
  )
);

-- El tablero (HU-07) consulta las pendientes de una persona: esas dos columnas
-- van de primeras en el índice.
create index alerta_destinatario_estado_idx
  on public.alerta (destinatario_id, estado);

create index alerta_orden_id_idx on public.alerta (orden_id);

comment on table public.alerta is
  'Alerta persistente con destinatario y estado (regla 7). Se resuelve marcándola atendida, no se borra.';

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- ---------------------------------------------------------------------------
-- Políticas temporales y abiertas como las de HU-01; las reemplaza HU-17, donde
-- cada quien verá y atenderá solo las suyas.
--
-- Hay `update` porque atender una alerta es cambiarle el estado a la fila que
-- ya existe. No hay `delete`: una alerta atendida se queda como rastro.

alter table public.alerta enable row level security;

create policy "temporal HU-17: alerta lectura abierta"
  on public.alerta for select to anon, authenticated using (true);

create policy "temporal HU-17: alerta alta abierta"
  on public.alerta for insert to anon, authenticated with check (true);

create policy "temporal HU-17: alerta atencion abierta"
  on public.alerta for update to anon, authenticated using (true) with check (true);
