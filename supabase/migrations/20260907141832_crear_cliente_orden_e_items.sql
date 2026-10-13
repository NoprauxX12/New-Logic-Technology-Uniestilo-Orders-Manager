-- HU-01 · Registrar una nueva orden.
--
-- Crea las tres tablas base del dominio: cliente, orden e item_orden.
-- El resto del modelo (avance_seccion, lote_taller, ficha_tecnica, alerta,
-- usuario) lo crean las HU que las necesitan.
--
-- NO existe una columna `estado` a propósito: el estado de una orden se deriva
-- de sus filas en avance_seccion (regla 1 de CLAUDE.md). Una orden sin avances
-- es, por definición, una orden "Registrada".

-- ---------------------------------------------------------------------------
-- cliente
-- ---------------------------------------------------------------------------
-- El NIT identifica al cliente: es la llave que usa el formulario de HU-01 para
-- decidir si reutiliza un cliente existente o crea uno nuevo.

create table public.cliente (
  id uuid primary key default gen_random_uuid(),
  nit text not null unique,
  razon_social text not null,
  contacto_nombre text not null,
  contacto_celular text not null,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- orden
-- ---------------------------------------------------------------------------

create table public.orden (
  id uuid primary key default gen_random_uuid(),

  -- Único en todo el sistema: criterio de aceptación de HU-01.
  numero_orden_compra text not null unique,

  cliente_id uuid not null references public.cliente (id),

  fecha_ingreso date not null,
  fecha_entrega date not null,

  observaciones text,

  -- Se llenan más adelante en el ciclo de vida de la orden.
  numero_orden_programacion text,                        -- HU-03
  numero_factura text,                                   -- HU-13, al cierre
  orden_original_id uuid references public.orden (id),   -- HU-18, correcciones

  -- Queda vacío hasta que exista el login (HU-16).
  creado_por uuid references auth.users (id),
  creado_en timestamptz not null default now(),

  -- Criterio de aceptación: la entrega no puede ser anterior al ingreso.
  constraint orden_fecha_entrega_no_anterior
    check (fecha_entrega >= fecha_ingreso)
);

create index orden_cliente_id_idx on public.orden (cliente_id);
create index orden_fecha_entrega_idx on public.orden (fecha_entrega);

-- ---------------------------------------------------------------------------
-- item_orden
-- ---------------------------------------------------------------------------
-- Una fila por prenda. `tallas` es texto libre en el MVP ("S:20, M:40, L:30"),
-- tal como se escribe hoy en el cuaderno. Si más adelante hace falta contar por
-- talla, se agrega una tabla propia sin tocar esta.

create table public.item_orden (
  id uuid primary key default gen_random_uuid(),

  -- Si se borra la orden, se van sus ítems: no tienen sentido por separado.
  orden_id uuid not null references public.orden (id) on delete cascade,

  descripcion text not null,
  cantidad integer not null,
  tallas text not null,
  valor numeric(12, 2) not null,
  observaciones text,

  cantidad_tela numeric(10, 2),                          -- HU-05
  creado_en timestamptz not null default now(),

  constraint item_orden_cantidad_positiva check (cantidad > 0),
  constraint item_orden_valor_no_negativo check (valor >= 0)
);

create index item_orden_orden_id_idx on public.item_orden (orden_id);

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- ---------------------------------------------------------------------------
-- Ninguna tabla se crea sin RLS (regla 5 de CLAUDE.md).
--
-- ATENCIÓN — POLÍTICAS TEMPORALES Y ABIERTAS.
-- El Sprint 1 no tiene login (HU-16) ni roles (HU-17), así que no hay usuario
-- que identificar y estas políticas dejan pasar a cualquiera. Se reemplazan por
-- políticas por rol en HU-17. Mientras existan, la base no está protegida.
--
-- No se otorga update ni delete: una orden registrada no se edita ni se borra;
-- las correcciones son una orden nueva (HU-18).

alter table public.cliente enable row level security;
alter table public.orden enable row level security;
alter table public.item_orden enable row level security;

create policy "temporal HU-17: cliente lectura abierta"
  on public.cliente for select to anon, authenticated using (true);

create policy "temporal HU-17: cliente alta abierta"
  on public.cliente for insert to anon, authenticated with check (true);

create policy "temporal HU-17: orden lectura abierta"
  on public.orden for select to anon, authenticated using (true);

create policy "temporal HU-17: orden alta abierta"
  on public.orden for insert to anon, authenticated with check (true);

create policy "temporal HU-17: item_orden lectura abierta"
  on public.item_orden for select to anon, authenticated using (true);

create policy "temporal HU-17: item_orden alta abierta"
  on public.item_orden for insert to anon, authenticated with check (true);
