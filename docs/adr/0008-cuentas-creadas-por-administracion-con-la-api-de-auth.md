# 0008. Las cuentas las administra administración con la API de Supabase Auth

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

El mismo patrón —primero `usuario` con la sesión y RLS, después Auth con la secret key, y si Auth falla se deshace lo de `usuario`— cubre el resto del ciclo:

- **Editar** nombre, correo y rol: update en `usuario` (política `admin edita perfiles`); si cambia el correo, `updateUserById({ email, email_confirm: true })`.
- **Cambiar contraseña**: solo Auth, `updateUserById({ password })`.
- **Desactivar y reactivar**: `usuario.activo` y, en Auth, `ban_duration` de cien años o `none`. `rol_actual()` devuelve null para una cuenta inactiva, así que todas las políticas le niegan lectura y escritura de inmediato aunque su token siga vivo; el bloqueo en Auth impide que vuelva a iniciar sesión.
- **Borrar**: solo si la persona no tiene rastro. `avance_seccion`, `lote_taller`, `ficha_tecnica`, `alerta` y `orden.creado_por` la referencian sin cascada a propósito (regla 3), así que el `delete` falla con `23503` y la pantalla ofrece desactivarla. El orden es perfil y luego Auth: `usuario.id` referencia a `auth.users`, así que al revés tampoco sería posible.
- **Nadie se cambia el rol, se desactiva ni se borra a sí mismo** (`reglas.ts`): si lo hiciera el único administrador, nadie podría volver a crear cuentas.

## Consecuencias

- Es la única excepción al ADR 0005 y la única pieza que usa la secret key desde la aplicación. Vercel necesita `SUPABASE_SECRET_KEY` como variable de entorno del servidor.
- Entre el paso 1 y el 2 puede quedar una cuenta sin perfil si el proceso muere justo ahí. Esa cuenta puede iniciar sesión pero no ve nada (RLS exige perfil); el log lo registra con el id para borrarla a mano.
- Una persona que ya marcó algo nunca se borra: se desactiva. Es la consecuencia directa de la auditoría inmutable.
- El email se guarda en minúsculas en los dos lados, que es como lo compara Supabase Auth.
