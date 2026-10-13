# 0007. RLS por rol derivada de checkpoints.ts y acceso por pantalla

Fecha: 2026-10-05 · Estado: Aceptada

## Contexto

Desde HU-01 todas las tablas tenían políticas RLS "temporal HU-17" con `using (true)` para `anon` y `authenticated`, y las funciones `registrar_orden` y `reportar_factura` tenían `grant execute` a `anon`. Con la URL del proyecto y la llave pública —que viaja en el navegador— cualquiera podía, sin iniciar sesión, leer clientes, órdenes y valores, insertar avances saltándose el motor de workflow y firmarlos con cualquier `usuario_id`, cerrar órdenes y cambiar la recepción de lotes. La aplicación era la única barrera, y tres pantallas (HU-10, HU-12, HU-13) tomaban además quién marcaba de un desplegable o de un id quemado, no de la sesión.

HU-16 dejó el login y el claim `user_role` en el JWT (ADR 0006), pero el proxy solo exigía sesión: cualquier rol abría cualquier pantalla escribiendo la URL.

## Decisión

**Quién actúa sale siempre de la sesión.** Ninguna action ni función de Postgres recibe el usuario como dato: `getUsuarioActual()` en la aplicación y `auth.uid()` en la base. Los desplegables de "quién reporta" desaparecen.

**RLS por rol, derivada de `checkpoints.ts`.** La migración `rls_por_rol` reemplaza las políticas temporales:

- Lectura: toda persona con sesión y perfil en `usuario` lee todo. El taller tiene quince personas y cada sección necesita ver la orden entera para saber si le toca; que cada rol vea solo su pantalla lo hace la aplicación.
- Escritura: solo el rol dueño, y firmando con su propio id (`usuario_id = auth.uid()`). En `avance_seccion`, el rol dueño lo da `rol_dueno(checkpoint)`, una función SQL que copia el mapa de `checkpoints.ts`; el test `rlsPorRol.test.ts` lee la migración y exige que los dos digan lo mismo (regla 4).
- `rol_actual()` lee el rol de `usuario` con `auth.uid()`. Es **SECURITY DEFINER**, la única excepción a la regla del ADR 0005, porque la política de `usuario` la llama y con SECURITY INVOKER entraría en recursión infinita. Es segura porque solo devuelve el rol de la propia persona.
- `anon` pierde todos los permisos de tabla, secuencia y función, incluidos los que Postgres concede a `public` por defecto y los que Supabase daría a tablas futuras. Convención para toda función nueva: `revoke execute from public, anon; grant execute to authenticated`.
- El registro de cuentas queda apagado (`enable_signup = false`): una cuenta creada desde afuera recibiría un JWT `authenticated`.

**Acceso por pantalla en la aplicación.** `accesoPorRuta.ts` es el único mapa de qué rol abre qué ruta, derivado también de `checkpoints.ts` (la pantalla de cada etapa es de su rol dueño; administración entra a todo). Cada página lo exige con `exigirAcceso(ruta)` antes de leer nada. El tablero pasa a ser solo de administración; logística tiene su propia lista en `/ordenes/talleres`.

El claim `user_role` del JWT sigue sin usarse: la tabla es la fuente de verdad y no depende de que el hook esté activado en el proyecto hospedado.

## Consecuencias

- Dos capas de verdad (RNF-04): la UI decide qué pantalla se muestra, RLS decide qué se escribe. Si una action olvida verificar el rol, la base rechaza la fila con `42501`.
- La auditoría (RNF-05) ya no se puede firmar por otro: `avance_seccion.usuario_id`, `lote_taller.enviado_por`, `lote_taller.recibido_por` y `orden.creado_por` llevan siempre `auth.uid()`.
- En el proyecto hospedado hay que dejar el registro de cuentas apagado (Authentication → Sign In / Up) y activar el hook si algún día se usa el claim. `config.toml` solo gobierna el CLI local.
- Toda tabla nueva necesita sus políticas; toda función nueva necesita su `revoke`/`grant`. Las migraciones de este ADR son el ejemplo.
- Un usuario nuevo sigue creándose solo desde el seed o con `SUPABASE_SECRET_KEY`: no hay pantalla de administración de personas.
- El PR #37 (`feature/HU-17-solo-admin-registra`) queda reemplazado por este cambio y debe cerrarse sin mezclar.
- Diseño no tiene pantalla hasta HU-04 y solo ve un aviso al entrar.
