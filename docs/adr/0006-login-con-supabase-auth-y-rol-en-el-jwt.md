# 0006. Login con Supabase Auth y el rol como claim del JWT

Fecha: 2026-09-09 · Estado: Aceptada

## Contexto

El Sprint 1 exige que cada avance quede registrado con quién lo marcó (regla 3, RNF-05), pero el login era HU-16 de Sprint 2. Mientras tanto, quien marca salía de un desplegable (`SelectorDeUsuario`) que ponía una cookie sin verificar nada — cualquiera podía decir que era cualquiera. `avance_seccion.usuario_id`, `lote_taller.enviado_por` y `lote_taller.recibido_por` ya dependían de esa cookie a través de `getUsuarioActual()`.

HU-17 (cada usuario ve solo lo de su rol) necesita, más adelante, políticas RLS que decidan por rol. Consultar la tabla `usuario` en cada política es una vuelta más a la base por cada fila; el rol como claim del JWT se lee sin consultar nada.

## Decisión

Login real con Supabase Auth (`signInWithPassword`), contra las seis cuentas que ya trae el seed. `getUsuarioActual()` cambia el cuerpo —no la firma— para leer `supabase.auth.getUser()` en vez de la cookie: ningún call site existente (`workflow`, `talleres`, `documentos`, `tablero`) se toca.

El rol se agrega además al JWT con un **Custom Access Token Hook**: una función de Postgres (`custom_access_token_hook`) que Supabase invoca al emitir cada token y le mete el rol de `usuario` como claim `user_role`. La invoca el rol `supabase_auth_admin`, con permisos otorgados aparte (sin `SECURITY DEFINER`), siguiendo el patrón que documenta Supabase para estos hooks.

El claim queda puesto pero **no se usa todavía**: `getUsuarioActual()` sigue prefiriendo la consulta a `usuario`, porque es más simple, no depende de que el token esté fresco, y HU-17 —que sí lo va a necesitar en las políticas RLS— no es esta historia. Adelantar su uso ahora sería resolver un problema que todavía no existe.

La protección de rutas es de una sola capa: el proxy exige sesión para todo lo que no sea `/` o `/login`, pero no exige rol por pantalla (salvo `/ordenes/nueva`, que ya lo hacía por su cuenta desde antes de esta historia). Verificar que cada pantalla sea del rol que le toca es HU-17.

## Consecuencias

- El selector de usuario desaparece: `SelectorDeUsuario.tsx`, `cambiarUsuarioActual` y `listarUsuarios` se borran completos, tal como sus propios comentarios anunciaban.
- Nadie entra al sistema sin contraseña, pero nada le impide a un correo válido ver una pantalla que no es de su rol si escribe la URL a mano. HU-17 cierra eso.
- Un usuario nuevo hoy solo se crea desde el seed o con `SUPABASE_SECRET_KEY` en un script de servidor: no hay pantalla de administración de personas.
- El hook exige que `auth.users` tenga los campos de token (`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`) en `''` y no en `NULL`: sin eso, GoTrue falla al buscar el usuario con un error genérico ("Database error querying schema") que no señala la columna. El seed ya lo tenía mal desde HU-01, sin que nadie lo notara porque nadie había intentado autenticarse de verdad.
