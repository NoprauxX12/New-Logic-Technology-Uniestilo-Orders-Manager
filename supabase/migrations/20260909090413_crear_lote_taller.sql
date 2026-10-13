-- Base de avances · Lotes enviados a los talleres satélite.
--
-- Un lote es entidad propia, no un checkpoint (regla 6): una orden se reparte
-- en varios talleres, cada uno recibe unas prendas y vuelve por su lado, así
-- que no cabe en un punto único de la línea de avance. Por eso `despacho a
-- taller` y `recepción de taller` no están en el enum `checkpoint`.
--
-- Cubre dos historias sobre la misma fila: HU-10 la crea al despachar y HU-11
-- la completa al recibir. Quien tome HU-11 confronta contra lo que dejó HU-10.
--
-- `taller` es texto libre a propósito: el catálogo de talleres satélite está en
-- los pendientes del CLAUDE.md. Cuando se decida, se vuelve una tabla y esta
-- columna pasa a ser una referencia.

create table public.lote_taller (
  id uuid primary key default gen_random_uuid(),

  orden_id uuid not null references public.orden (id),

  taller text not null,
  descripcion_prendas text not null,

  -- Despacho (HU-10). Siempre presente: sin esto la fila no existiría.
  fecha_envio timestamptz not null default now(),
  enviado_por uuid not null references public.usuario (id),

  -- Recepción (HU-11). Nulos mientras el lote siga afuera.
  recibido_completo boolean,
  fecha_recepcion timestamptz,
  recibido_por uuid references public.usuario (id),
  observaciones_recepcion text,

  -- O el lote está recibido con sus tres datos, o no está recibido y los tres
  -- están vacíos. Evita lotes a medio recibir, que dejarían a HU-11 sin saber
  -- si el dato falta o si nunca llegó.
  constraint lote_taller_recepcion_completa check (
    (recibido_completo is null
      and fecha_recepcion is null
      and recibido_por is null)
    or
    (recibido_completo is not null
      and fecha_recepcion is not null
      and recibido_por is not null)
  ),

  -- No se puede recibir antes de despachar.
  constraint lote_taller_recepcion_no_anterior check (
    fecha_recepcion is null or fecha_recepcion >= fecha_envio
  )
);

create index lote_taller_orden_id_idx on public.lote_taller (orden_id);

comment on table public.lote_taller is
  'Un lote de prendas enviado a un taller satélite. HU-10 lo despacha, HU-11 confirma su recepción.';

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- ---------------------------------------------------------------------------
-- Ninguna tabla se crea sin RLS (regla 5).
--
-- ATENCIÓN — POLÍTICAS TEMPORALES Y ABIERTAS, como las de HU-01. Las reemplaza
-- HU-17, donde solo `logistica` podrá despachar y recibir.
--
-- A diferencia de `avance_seccion`, aquí SÍ hay `update`: la recepción (HU-11)
-- completa la fila que creó el despacho (HU-10). No es una bitácora inmutable,
-- es el estado de un lote. No se otorga `delete`.

alter table public.lote_taller enable row level security;

create policy "temporal HU-17: lote lectura abierta"
  on public.lote_taller for select to anon, authenticated using (true);

create policy "temporal HU-17: lote alta abierta"
  on public.lote_taller for insert to anon, authenticated with check (true);

create policy "temporal HU-17: lote recepcion abierta"
  on public.lote_taller for update to anon, authenticated using (true) with check (true);
