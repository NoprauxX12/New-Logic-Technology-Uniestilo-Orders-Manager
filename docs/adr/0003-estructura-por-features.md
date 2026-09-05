# 0003. Estructura de carpetas por features dentro de `src/`

Fecha: 2026-09-05 · Estado: Aceptada

## Contexto

El scaffold de `create-next-app` deja `app/` en la raíz y nada más. Con cinco personas tocando HU distintos en paralelo, una estructura por capas (`components/`, `actions/`, `lib/` globales) hace que todos editen las mismas carpetas y choquen en los merges, y no refleja el diseño de arquitectura, que ya define módulos: gestión de órdenes, motor de workflow, lotes a taller, tablero, alertas, documentos, IA.

## Decisión

- Todo el código de la aplicación va bajo `src/` (soportado por Next); la raíz queda para configuración.
- `src/app/` es solo enrutamiento. La lógica vive en `src/features/<feature>/` con una convención fija: `actions.ts`, `queries.ts`, `schemas.ts`, `components/` y tests al lado.
- Un módulo por área del dominio, alineado con el diagrama de componentes: `ordenes`, `workflow`, `talleres`, `tablero`, `auth`, `alertas`, `documentos`.
- `src/components/` solo para UI sin dominio; `src/lib/` para infraestructura compartida (Supabase, IA, utilidades).
- Una feature no importa de otra, excepto de `workflow`, que es el corazón del dominio y del que todas dependen.

## Consecuencias

- Cada HU toca su feature y su ruta: menos conflictos de merge y revisión más fácil (el revisor sabe dónde mirar).
- La regla "toda mutación de avance pasa por `workflow`" tiene un lugar físico que se puede vigilar en revisión.
- Cuando algo se necesita en dos features hay que promoverlo a `src/lib/` o `src/components/` en vez de importar en cruz; cuesta un poco más, pero evita el enredo.
