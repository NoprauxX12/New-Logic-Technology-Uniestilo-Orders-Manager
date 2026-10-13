# 0005. Las escrituras que tocan varias tablas van en funciones de Postgres

Fecha: 2026-09-07 · Estado: Aceptada

## Contexto

Registrar una orden (HU-01) escribe en tres tablas: busca o crea el cliente, inserta la orden e inserta sus prendas. El cliente de JavaScript de Supabase no tiene transacciones: cada llamada viaja por separado y se confirma sola. Si la tercera falla, queda una orden guardada sin prendas —un registro corrupto que el tablero mostraría mal— y no se puede deshacer, porque las políticas RLS no otorgan `delete`.

Hay además una carrera: buscar el cliente por NIT y crearlo si no está son dos operaciones, y dos personas registrando al mismo cliente nuevo a la vez pueden crearlo dos veces.

HU-11 (confirmar recepción del taller) y HU-13 (cerrar la orden con etiquetas, despacho y factura) tienen la misma forma: varias escrituras que solo valen si se aplican juntas.

## Decisión

Toda mutación que toque más de una tabla se escribe como una función de Postgres en una migración, y la server action la invoca una sola vez con `supabase.rpc()`. La función corre dentro de una transacción, así que se aplica entera o no se aplica nada.

La primera es `registrar_orden`, en `supabase/migrations/20260907145217_crear_funcion_registrar_orden.sql`.

Dos reglas para escribirlas:

- **`SECURITY INVOKER`**, que es el valor por defecto: la función corre con los permisos de quien la llama y respeta las políticas RLS. No usar `SECURITY DEFINER`, que las saltaría y dejaría a HU-17 sin control por rol.
- **`set search_path = ''`** y cada tabla calificada con su esquema (`public.orden`), para que nadie pueda redirigir la función a tablas suyas.

La validación de la entrada sigue haciéndose en la action con el esquema de zod, antes de llamar a la función. La función no valida reglas de negocio: garantiza integridad.

## Consecuencias

- Una orden a medio guardar deja de ser posible, y el `on conflict` de la función resuelve de paso la carrera del cliente duplicado.
- Cada operación de este tipo cuesta una migración y algo de PL/pgSQL, que no todo el equipo maneja.
- La lógica queda repartida entre TypeScript y SQL. Para saber qué pasa al guardar una orden hay que leer los dos archivos.
- Las funciones se prueban contra la base, no con Vitest. Las pruebas automáticas siguen cubriendo la validación y la traducción del formulario, que es donde `CLAUDE.md` pone el riesgo del dominio.
- HU-11 y HU-13 tienen el patrón resuelto y un ejemplo del que copiar.
