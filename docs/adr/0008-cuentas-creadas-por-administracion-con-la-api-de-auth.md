# 0008. Las cuentas las crea administración con la API de Supabase Auth

Fecha: 2026-10-07 · Estado: Aceptada

## Contexto

Con HU-17 el registro público de cuentas quedó apagado (ADR 0007), así que un usuario nuevo solo se creaba con el seed o con `SUPABASE_SECRET_KEY` desde un script. En producción eso significa que el equipo de desarrollo tendría que crear cada cuenta a mano cuando Uniestilo contrate a alguien. Hace falta una pantalla (HU-24, numeración provisional) con la que administración cree la cuenta y le dé su rol.

Crear una persona son dos escrituras: la cuenta en `auth.users` y el perfil en `public.usuario`. El ADR 0005 manda las escrituras multitabla a una función de Postgres, pero `auth.users` no se debe escribir con SQL desde la aplicación: la contraseña la hashea GoTrue y el esquema `auth` es suyo.

## Decisión

- La cuenta se crea con la **API de administración de Supabase Auth** (`auth.admin.createUser`, `email_confirm: true`), desde un cliente que usa `SUPABASE_SECRET_KEY`. Ese cliente vive en `src/lib/supabase/admin.ts`, es `server-only`, y **solo** se usa para Auth: nunca para leer ni escribir tablas del dominio, que siguen pasando por el cliente con sesión y RLS.
- El perfil se inserta en `usuario` con la **sesión del administrador**, para que la política RLS `admin crea perfiles` vuelva a comprobar el rol en la base (dos capas, regla 5).
- Si el perfil falla, la action **borra la cuenta recién creada** (`auth.admin.deleteUser`). Es la compensación manual que reemplaza la transacción que aquí no puede haber.
- La contraseña inicial la escribe administración en el formulario y se la dice a la persona. Es la opción que no depende de correo, porque todavía no hay SMTP propio; cuando lo haya, puede volverse una invitación por correo sin tocar la política ni el perfil.
- La action verifica `admin` con `getUsuarioActual()` antes de tocar la API: la secret key no debe ejecutarse por un POST directo de otro rol.

## Consecuencias

- Es la única excepción al ADR 0005 y la única pieza que usa la secret key desde la aplicación. Vercel necesita `SUPABASE_SECRET_KEY` como variable de entorno del servidor.
- Entre el paso 1 y el 2 puede quedar una cuenta sin perfil si el proceso muere justo ahí. Esa cuenta puede iniciar sesión pero no ve nada (RLS exige perfil); el log lo registra con el id para borrarla a mano.
- No hay edición ni borrado de personas: cambiar de rol o retirar a alguien es una historia aparte.
- El email se guarda en minúsculas en los dos lados, que es como lo compara Supabase Auth.
