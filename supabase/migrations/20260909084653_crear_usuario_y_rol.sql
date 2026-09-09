-- Base de avances · Usuarios del sistema y su rol.
--
-- Es la primera pieza de la base compartida que necesitan las historias de
-- marcado (HU-08, HU-10, HU-11, HU-12, HU-19, HU-13) y el tablero (HU-14): un
-- avance registra quién lo marcó (regla 3, RNF-05), así que `avance_seccion`
-- no se puede crear sin esta tabla.
--
-- No es HU-16. Aquí no hay pantalla de login ni sesión: solo el modelo de quién
-- existe y qué rol tiene. HU-16 le pondrá encima la autenticación y HU-17 las
-- políticas por rol que hoy quedan abiertas.

-- ---------------------------------------------------------------------------
-- rol
-- ---------------------------------------------------------------------------
-- Los seis roles del modelo. El orden de los valores importa poco aquí, pero
-- un enum de Postgres solo se puede ampliar (`alter type ... add value`), no
-- reordenar ni renombrar sin recrear el tipo.
--
-- Pendiente del CLAUDE.md: HU-19 la marca "terminación", que no es ninguno de
-- estos seis. Cuando el equipo decida si es un rol nuevo o lo marca `marcacion`,
-- se resuelve con una migración de una línea.

create type public.rol as enum (
  'admin',
  'secretaria',
  'diseno',
  'corte',
  'logistica',
  'marcacion'
);

-- ---------------------------------------------------------------------------
-- usuario
-- ---------------------------------------------------------------------------
-- El `id` es el mismo de `auth.users`: un perfil por cuenta de autenticación.
-- Se hace así porque `orden.creado_por` ya referencia `auth.users` desde HU-01;
-- darle a `usuario` un id propio dejaría dos identidades distintas para la misma
-- persona.
--
-- Sin `on delete cascade` a propósito: la auditoría es inmutable (regla 3), así
-- que un usuario que ya marcó avances no se puede borrar. Postgres bloquea el
-- borrado en vez de arrastrar las filas de `avance_seccion`.
--
-- `email` se guarda aquí aunque también viva en `auth.users` para poder mostrar
-- y filtrar sin consultar el esquema `auth`, que tiene sus propios permisos.

create table public.usuario (
  id uuid primary key references auth.users (id),

  nombre text not null,
  email text not null unique,
  rol public.rol not null,

  creado_en timestamptz not null default now(),

  constraint usuario_nombre_no_vacio check (length(trim(nombre)) > 0)
);

create index usuario_rol_idx on public.usuario (rol);

comment on table public.usuario is
  'Perfil de cada persona del taller: su nombre, su correo y el rol que determina qué puede marcar.';

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila (RLS)
-- ---------------------------------------------------------------------------
-- Ninguna tabla se crea sin RLS (regla 5).
--
-- ATENCIÓN — POLÍTICA TEMPORAL Y ABIERTA, igual que las de HU-01. Mientras no
-- exista login (HU-16) no hay a quién identificar. La reemplaza HU-17.
--
-- No se otorga insert, update ni delete: los usuarios los crea el seed o un
-- administrador con `SUPABASE_SECRET_KEY`, que salta RLS. Desde el navegador no
-- se puede crear ni modificar a nadie.

alter table public.usuario enable row level security;

create policy "temporal HU-17: usuario lectura abierta"
  on public.usuario for select to anon, authenticated using (true);
