-- Base de avances · Ficha técnica adjunta a una orden (HU-04, Sprint 2).
--
-- Se crea desde ya para que quien tome HU-04 no tenga que diseñar la tabla, y
-- porque el checkpoint `ficha_adjunta` ya existe en el enum del flujo.
--
-- El archivo vive en Supabase Storage bajo `<bucket>/<orden_id>/<archivo>`; en
-- la base va solo la ruta y los metadatos (CLAUDE.md, sección Supabase).
--
-- DESVIACIÓN del diagrama, para que quede visible: el modelo llama a esta
-- columna `archivo_url`, y aquí se llama `archivo_ruta`. La diferencia no es
-- cosmética: una URL de Storage se firma y expira, así que guardarla dejaría
-- filas que apuntan a nada a los pocos minutos. Lo que se guarda es la ruta, y
-- la URL se firma en el momento de mostrarla. Si el equipo prefiere el nombre
-- del diagrama, se cambia con una migración de renombrado.
--
-- Una orden puede tener varias fichas: no hay restricción de unicidad sobre
-- `orden_id`. Si HU-04 define que solo vale la última, se agrega ahí.

create table public.ficha_tecnica (
  id uuid primary key default gen_random_uuid(),

  orden_id uuid not null references public.orden (id),

  archivo_ruta text not null,
  subida_por uuid not null references public.usuario (id),
  fecha_subida timestamptz not null default now(),

  constraint ficha_tecnica_ruta_no_vacia check (length(trim(archivo_ruta)) > 0)
);

create index ficha_tecnica_orden_id_idx on public.ficha_tecnica (orden_id);

comment on table public.ficha_tecnica is
  'Ficha técnica de una orden. Guarda la ruta en Storage, no una URL firmada.';

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- ---------------------------------------------------------------------------
-- Políticas temporales y abiertas como las de HU-01; las reemplaza HU-17, donde
-- solo `diseno` podrá adjuntar. Sin update ni delete: una ficha equivocada se
-- corrige subiendo otra, igual que un avance mal marcado.

alter table public.ficha_tecnica enable row level security;

create policy "temporal HU-17: ficha lectura abierta"
  on public.ficha_tecnica for select to anon, authenticated using (true);

create policy "temporal HU-17: ficha alta abierta"
  on public.ficha_tecnica for insert to anon, authenticated with check (true);
