@AGENTS.md

# Uniestilo Orders Manager

Guía de trabajo para el equipo y para Claude Code. Léela completa antes de tocar código. El flujo de ramas y PRs está en `CONTRIBUTING.md`; las decisiones de arquitectura en `docs/adr/`.

## Contexto

ERP a la medida para **Uniestilo S.A.S.**, empresa de confección en Marinilla (~15 empleados) que hoy gestiona las órdenes de producción en cuadernos y WhatsApp. El sistema digitaliza el ciclo completo de una orden y deja rastro de quién hizo qué y cuándo. Proyecto Integrador 2, EAFIT 2026-2, equipo de 5 (New Logic Technology). La empresa es cliente real y hay una Product Owner (Laura).

- Backlog: https://github.com/users/NoprauxX12/projects/7/views/3
- Identificador canónico: **HU-XX** (del backlog). El número de issue de GitHub es otro y **no coincide** con el HU. Nunca asumir que HU-13 es el issue #13.
- Todo en **español**: UI, commits, PRs, comentarios y nombres de dominio. Los identificadores de código (variables, funciones, tablas) van en español sin tildes ni eñes: `ordenId`, `fechaEntrega`, `avance_seccion`.

## Stack

| Capa       | Tecnología                                               | Notas                                                                                                                                               |
| ---------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | Next.js 16 (App Router) + React 19 + TypeScript estricto | `proxy.ts` reemplaza a `middleware.ts`. Ante cualquier duda de API consultar `node_modules/next/dist/docs/`: esta versión difiere de lo que conoces |
| Estilos    | Tailwind CSS 4                                           | Sin `tailwind.config`; el tema vive en `src/app/globals.css`                                                                                        |
| Backend    | Supabase: Postgres + RLS, Auth, Storage, Realtime        | Sin servidor propio. Toda mutación pasa por Server Actions                                                                                          |
| Despliegue | Vercel                                                   | `main` → producción; `develop` y cada PR → preview                                                                                                  |
| IA         | Proveedor por decidir                                    | Todo detrás de `src/lib/ai/`; el SDK del proveedor no sale de ahí (RNF-12)                                                                          |

Node 22 (`.nvmrc`) y npm. No usar pnpm, yarn ni bun: un solo lockfile.

## Comandos

| Comando                             | Qué hace                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                       | Servidor de desarrollo en http://localhost:3000                                 |
| `npm run build`                     | Build de producción (lo mismo que corre Vercel)                                 |
| `npm run lint` / `npm run lint:fix` | ESLint (next/core-web-vitals + typescript, sin reglas que choquen con Prettier) |
| `npm run format` / `format:check`   | Prettier sobre todo el repo                                                     |
| `npm run typecheck`                 | `next typegen` + `tsc --noEmit`                                                 |
| `npm test`                          | Vitest en modo watch                                                            |
| `npm run test:run`                  | Vitest una sola vez (lo que corre CI)                                           |
| `npm run check`                     | format:check + lint + typecheck + test:run. **Correrlo antes de abrir un PR**   |
| `npm run db:types`                  | Regenera `src/types/database.types.ts` desde la base local de Supabase          |

Un solo test: `npx vitest run src/features/workflow/transitions.test.ts`, o por nombre: `npx vitest run -t "no permite repetir"`.

Los hooks de git (Husky) corren solos: `pre-commit` formatea y lintea lo staged; `commit-msg` valida el formato del mensaje. No se saltan con `--no-verify`.

## Estructura

```
src/
  app/                    Solo enrutamiento: page, layout, loading, error, route. Sin lógica de negocio.
    (auth)/               Rutas públicas: login (HU-16)
    (app)/                Rutas con sesión; su layout carga el usuario y su rol
      tablero/            HU-14 — administrador
      ordenes/            Lista según rol, nueva (HU-01), [ordenId] detalle + acciones de su sección
    api/health/           Health check para el monitoreo (RNF-06)
  features/               Un módulo por área del dominio. Cada uno es dueño de sus
                          server actions, consultas, validaciones y componentes.
    ordenes/              HU-01, HU-02, HU-03, HU-05
    workflow/             Motor de checkpoints: HU-08, HU-09, HU-12, HU-19, HU-13 (RNF-05)
    talleres/             Lotes a taller satélite: HU-10, HU-11
    tablero/              HU-14 + suscripción Realtime
    auth/                 Sesión, roles y MFA: HU-16, HU-17
    alertas/              HU-06, HU-07, HU-20 (post-MVP)
    documentos/           Etiquetas y documentos de despacho: HU-13
  components/
    ui/                   Primitivos reutilizables sin dominio (Button, Input, Badge…)
    layout/               AppShell, navegación por rol
  lib/
    supabase/             client.ts (navegador), server.ts (servidor), session.ts (proxy)
    ai/                   Interfaz propia sobre el LLM (post-MVP)
    utils/                Helpers puros: fechas, moneda, cn()
  types/                  database.types.ts (generado) y tipos de dominio
  proxy.ts                Refresca la sesión en cada petición; redirección a login en HU-16
supabase/
  migrations/             SQL versionado. Una migración por cambio; nunca editar una ya aplicada
  seed.sql                Datos de prueba: un usuario por rol y órdenes de ejemplo
docs/adr/                 Decisiones de arquitectura, una por archivo
.github/                  CI, plantilla de PR, CODEOWNERS
scripts/                  Utilidades del repo (protección de ramas)
```

Convención dentro de cada feature:

```
src/features/<feature>/
  actions.ts        "use server". Mutaciones: validan entrada, verifican rol, llaman al workflow
  queries.ts        Lecturas para Server Components (import "server-only")
  schemas.ts        Esquemas de validación (zod) compartidos por formulario y action
  components/       Componentes propios de la feature (PascalCase)
  *.test.ts(x)      Tests al lado del código que prueban
```

Reglas de ubicación:

- Un componente lo usa una sola feature → vive en esa feature. Lo usan dos o más → `src/components/`.
- `src/app/**/page.tsx` es delgado: obtiene datos con `queries.ts` y renderiza componentes de la feature.
- Una feature no importa de otra feature, salvo de `workflow` (todas dependen del motor). Lo que necesitan dos features va a `src/lib/`.

## Convenciones de código

- **Nombres.** Componentes React y sus archivos en `PascalCase` (`OrdenCard.tsx`). Funciones, variables, hooks y demás archivos en `camelCase` (`useOrden.ts`, `formatFecha.ts`, `getOrdenes()`). Variables de entorno en `UPPER_SNAKE_CASE`. Carpetas en `kebab-case`. Tablas y columnas SQL en `snake_case`.
- **Prettier manda.** Configuración por defecto más el orden de clases de Tailwind. El editor formatea al guardar (`.vscode/settings.json`). No se discute estilo en los PRs.
- **TypeScript estricto.** Prohibidos `any` y `@ts-ignore`. Si un tipo es difícil: `unknown` y estrechar. Los tipos de la base salen de `src/types/database.types.ts`, nunca se escriben a mano.
- **Server first.** Los componentes son Server Components por defecto. `"use client"` solo en las hojas que necesiten estado, efectos o eventos, lo más abajo posible del árbol.
- **Mutaciones solo con Server Actions** (`actions.ts`). Route Handlers (`app/api`) únicamente para webhooks, cron y health check.
- **Validar en el borde.** Toda action valida su entrada con un esquema antes de tocar la base. Mensajes de error en español y en lenguaje del taller.
- **Imports** con alias `@/` (`@/features/ordenes/queries`). Nada de rutas relativas que suban de nivel (`../../`).
- **Sin código muerto ni `TODO`** en PRs a `develop`. Lo pendiente se abre como issue.
- **UI para gente no digital (RNF-08/09/10):** máximo 1–2 acciones por pantalla por rol, botones grandes, textos del taller sin jerga, responsive desde 360 px, contraste AA.

## Reglas del dominio (no negociables)

Salen del diseño de arquitectura y de los RNF. Un PR que las rompa no se mezcla.

1. **El estado de una orden se deriva, no se guarda.** No existe una columna `estado` editable: el estado es la agregación de las filas de `avance_seccion`. El tablero (HU-14) se construye leyendo esos avances.
2. **Toda mutación de avance pasa por el motor de workflow** (`src/features/workflow`). Ninguna action inserta en `avance_seccion` por su cuenta. El motor verifica que el checkpoint sea el siguiente válido en la secuencia, que el rol del usuario sea el dueño de esa sección y que no se repita uno ya marcado.
3. **La auditoría es inmutable (RNF-05).** Un avance registra `usuario_id` y `fecha_hora` y nunca se edita ni se borra. Un error se corrige con un registro nuevo o con una orden de corrección (HU-18).
4. **La secuencia de checkpoints y el rol dueño de cada uno viven en un solo lugar:** `src/features/workflow/checkpoints.ts`. UI, actions y políticas RLS se derivan de ahí. Si cambia el flujo, cambia ese archivo y una migración.
5. **Autorización en dos capas.** La UI muestra a cada rol solo lo suyo; RLS lo garantiza en la base aunque la UI falle (RNF-04). Ninguna tabla se crea sin políticas RLS.
6. **Un lote a taller es entidad propia** (`lote_taller`), no un checkpoint: una orden se reparte en varios lotes y HU-11 confronta lo recibido contra lo enviado.
7. **Las alertas son persistentes** (`alerta` con destinatario y estado), no notificaciones efímeras (HU-07).
8. **Facturación fuera de alcance.** El sistema no emite facturas: en el cierre (HU-13) solo registra que se emitió y captura el número.
9. **La IA solo informa, no decide ni muta** (HU-15, HU-21). Acceso de solo lectura a los datos.

Roles (enum `rol`) y lo que marca cada uno:

| Rol          | Marca                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| `admin`      | Registra órdenes, ve todo el tablero, resuelve alertas, usa el asistente           |
| `secretaria` | Cotización, programación a diseño y de tela, validación de insumos, cierre (HU-13) |
| `diseno`     | Ficha técnica (HU-04)                                                              |
| `corte`      | Corte completado (HU-08)                                                           |
| `logistica`  | Recogido/bordado (HU-09), despacho a taller (HU-10), recepción del taller (HU-11)  |
| `marcacion`  | Llegada a marcación (HU-12)                                                        |

HU-19 (lista para despachar) la marca "terminación"; ver pendientes al final.

## Backlog (HU → sprint)

| Sprint 1 (MVP)                                    | Sprint 2                                   | Sprint 3                                       |
| ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| HU-01 registrar orden                             | HU-16 login con usuario y rol              | HU-18 orden de corrección por defectos         |
| HU-08 marcar corte completado                     | HU-17 cada usuario ve solo lo de su rol    | HU-03 programación a diseño                    |
| HU-10 despachar lote a taller                     | HU-15 asistente responde en qué etapa va   | HU-05 programar cantidad de tela por ítem      |
| HU-11 confirmar recepción del taller              | HU-02 cotización enviada y aprobada        | HU-09 marcar recogido y bordado                |
| HU-12 marcar llegada a marcación                  | HU-04 adjuntar ficha técnica               | HU-23 validar insumos según orden de compra    |
| HU-19 marcar lista para despachar                 | HU-06 alerta por falta de tela             | HU-20 alerta por proximidad a fecha de entrega |
| HU-13 cerrar orden (etiquetas, despacho, factura) | HU-07 ver y resolver alertas en el tablero | HU-21 asistente señala atrasos y pendientes    |
| HU-14 tablero de avance                           | HU-22 marcar llegada de telas              |                                                |

## Supabase

- Un solo cliente por contexto: `createClient()` de `@/lib/supabase/server` en Server Components, actions y route handlers; `@/lib/supabase/client` solo dentro de `"use client"`. No se instancian clientes de `@supabase/supabase-js` en ningún otro lado.
- `SUPABASE_SECRET_KEY` salta RLS: jamás en código que llegue al navegador ni en `NEXT_PUBLIC_*`. Solo para scripts de seed o administración en servidor.
- Esquema con migraciones: `npx supabase migration new <nombre>` → escribir el SQL → `npx supabase db reset` en local → PR. Nombres descriptivos en snake_case: `crear_orden_e_items`, `rls_avance_seccion`.
- Tras cambiar el esquema: `npm run db:types` y subir `database.types.ts` en el mismo PR.
- Realtime solo para el tablero (HU-14); el resto son lecturas normales.
- Archivos (fichas técnicas, documentos de despacho) en Storage bajo `<bucket>/<orden_id>/<archivo>`; en la base solo la ruta y los metadatos.

## Testing

- Unitarios con Vitest + Testing Library, al lado del código (`*.test.ts(x)` dentro de `src/`).
- Obligatorio probar: las reglas puras del workflow (transiciones válidas, rol permitido, no repetir checkpoint) y los esquemas de validación. Ahí vive el riesgo del dominio.
- Componentes: se prueban los que tienen lógica (formularios, guardas por rol). Los Server Components `async` no se prueban con Vitest; para flujos completos se agregará Playwright después del Sprint 1.
- CI corre `npm run check` en cada PR. Un PR con CI en rojo no se revisa.

## Git y PRs (resumen; el detalle está en CONTRIBUTING.md)

- `main` = producción, `develop` = integración. Nadie hace push directo a ninguna: solo PRs con 1 aprobación y CI en verde.
- Rama por HU desde `develop`: `feature/HU-01-registrar-orden`, `fix/HU-08-doble-marcado`, `chore/ci-cache`.
- Commits en Conventional Commits con el HU como scope: `feat(HU-01): registrar orden con sus ítems`. Lo valida commitlint.
- Título del PR con el mismo formato. PR contra `develop`; solo el release de cada sprint va de `develop` a `main`.
- PRs pequeños: un HU (o una parte de uno) por PR.

## Definición de terminado

Un HU está terminado cuando cumple sus criterios de aceptación, tiene tests de sus reglas, su migración y políticas RLS están en el repo, la UI funciona en celular y escritorio, `npm run check` pasa, el PR fue aprobado y mezclado a `develop`, y el cambio se ve en el preview de Vercel.

## Pendientes por confirmar

Las decisiones cerradas están en `docs/adr/`. Abierto con el equipo o la PO:

- HU-19 la marca "terminación (Marcela)", pero el modelo tiene 6 roles y `terminacion` no es uno. Definir si es un rol nuevo o si lo marca `marcacion`.
- El documento de arquitectura asigna la autenticación a HU-21; el backlog la pone en HU-16/HU-17 y HU-21 es el asistente. Unificar.
- El Sprint 1 exige "queda registro de quién marcó" pero el login (HU-16) es Sprint 2. Hace falta al menos un login básico en Sprint 1.
- Proveedor de LLM.
- Catálogo de talleres satélite (hoy texto libre en HU-10).
