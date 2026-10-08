-- HU-24 · Administración edita, desactiva, reactiva y borra cuentas.
--
-- Completa la migración anterior (crear). Tres piezas:
--
-- 1. `usuario.activo`. Una persona que se va del taller no se puede borrar si
--    alguna vez marcó algo: `avance_seccion`, `lote_taller`, `ficha_tecnica`,
--    `alerta` y `orden.creado_por` la referencian sin cascada, a propósito,
--    porque la auditoría es inmutable (regla 3). Lo que sí se puede es apagarle
--    la cuenta. La aplicación además la bloquea en Supabase Auth; esta columna
--    es la capa de la base.
--
-- 2. `rol_actual()` devuelve null para una cuenta inactiva. Como todas las
--    políticas de lectura exigen `rol_actual() is not null`, una persona
--    desactivada deja de ver y de escribir de inmediato, aunque su sesión siga
--    viva hasta que expire el token.
--
-- 3. Políticas de update y delete sobre `usuario`, solo para admin. El borrado
--    lo frena la base cuando la persona tiene rastro (error 23503), y la
--    aplicación lo traduce a "desactívala en vez de borrarla".

alter table public.usuario
  add column activo boolean not null default true;

comment on column public.usuario.activo is
  'HU-24: false cuando administración desactiva la cuenta. Sin acceso, con su rastro intacto.';

create or replace function public.rol_actual()
returns public.rol
language sql
stable
security definer
set search_path = ''
as $$
  select rol from public.usuario where id = auth.uid() and activo
$$;

create policy "admin edita perfiles" on public.usuario
  for update to authenticated
  using (public.rol_actual() = 'admin')
  with check (public.rol_actual() = 'admin');

create policy "admin borra perfiles sin rastro" on public.usuario
  for delete to authenticated
  using (public.rol_actual() = 'admin');
