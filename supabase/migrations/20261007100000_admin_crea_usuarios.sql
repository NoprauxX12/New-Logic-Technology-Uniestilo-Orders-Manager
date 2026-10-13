-- HU-24 · Administración crea las cuentas de las personas del taller.
--
-- Hasta ahora un usuario nuevo solo se creaba con el seed o con la secret key
-- desde un script: no había pantalla. La cuenta de autenticación la crea la
-- aplicación con la API de administración de Supabase Auth (eso no se puede
-- hacer con SQL desde la aplicación), y el perfil en `usuario` lo inserta con la
-- sesión de quien administra. Esta política es lo que se lo permite, y solo a
-- `admin`: nadie más puede darle rol a nadie.
--
-- El `id` del perfil tiene que ser el de la cuenta recién creada (es llave
-- foránea a `auth.users`), así que no hay forma de inventar un perfil suelto.
-- Sin update ni delete: una persona que cambia de rol o se va es una decisión
-- que todavía no tiene historia; cuando la tenga, tendrá su política.

create policy "admin crea perfiles" on public.usuario
  for insert to authenticated
  with check (public.rol_actual() = 'admin');
