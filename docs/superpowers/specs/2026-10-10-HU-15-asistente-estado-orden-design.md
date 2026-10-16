# HU-15 · Asistente de solo lectura para el estado de las órdenes

Fecha: 2026-10-10 · Rama: `feature/HU-15-asistente-estado-orden` (sale de `feature/HU-24-crear-usuarios`)

## Historia

Como administrador, cuando le pregunte al asistente en lenguaje natural por el
estado de un pedido, el sistema me debe responder con la información de la
orden y en qué etapa va. El asistente no toma decisiones: solo informa, en modo
de solo lectura (regla 10 de CLAUDE.md).

## Alcance

- Panel flotante a la derecha, visible en toda pantalla con sesión de `admin`.
- Responde por: etapa actual de una orden, quién marcó qué y cuándo, lo que
  sigue y a quién le toca, lotes en taller, fecha de entrega y semáforo, y
  conteos (todas, atrasadas, en riesgo, en producción).
- Fuera: HU-21 (atrasos y sugerencias), historial persistente, otros roles,
  streaming.

## Decisiones

1. **Capa de IA** en `src/lib/ai/` con Vercel AI SDK (`ai`) y `@ai-sdk/groq`.
   El SDK del proveedor no sale de `src/lib/ai/proveedor.ts` (RNF-12). La
   interfaz pública es `responderConHerramientas({ sistema, mensajes,
herramientas })` → `{ texto }`.
2. **Acceso a datos por herramientas tipadas**, no por SQL generado ni MCP:
   `buscarOrdenes`, `estadoDeOrden`, `resumenOrdenes`. Cada una ejecuta
   consultas `select` con el cliente de Supabase de la sesión (RLS aplica). El
   solo-lectura se garantiza por construcción: no existe herramienta que escriba.
3. **Transporte: Server Action sin streaming** (`preguntarAlAsistente`).
   Respeta "mutaciones y lógica por actions; route handlers solo para webhooks,
   cron y health".
4. **Contexto en el navegador.** Los mensajes viven en estado de React y se
   mandan completos en cada pregunta, recortados a `IA_MAX_MENSAJES_CONTEXTO`.
   Sin tabla ni migración.
5. **Autorización en dos capas.** El layout monta el panel solo para `admin`;
   la action vuelve a verificar el rol; las herramientas leen con la sesión.
6. **Estado de la orden promovido a `src/lib/ordenes/`.** La derivación que hoy
   vive en `features/tablero` (`queries.ts`, `reglas.ts`, `types.ts`) se mueve
   a `lib/` porque la necesitan dos features (ADR 0003). El tablero importa de
   ahí; su comportamiento no cambia.
7. **Configuración perezosa.** `src/lib/ai/config.ts` valida las variables con
   zod al usarlas, no al cargar el módulo: el build no exige la llave. Si falta,
   el panel dice "El asistente no está configurado".

## Variables de entorno (solo servidor)

```
IA_PROVEEDOR=groq
IA_API_KEY=
IA_MODELO=llama-3.3-70b-versatile
IA_MAX_MENSAJES_CONTEXTO=20
IA_MAX_TOKENS_RESPUESTA=600
IA_TEMPERATURA=0.2
IA_MAX_PASOS_HERRAMIENTAS=4
IA_TIEMPO_MAXIMO_MS=20000
```

## Archivos

Nuevos: `src/lib/ai/{config,proveedor,index}.ts`, `src/lib/ordenes/{estadoOrden,reglas,types}.ts`,
`src/features/asistente/{actions,herramientas,prompt,schemas}.ts`,
`src/features/asistente/components/AsistenteFlotante.tsx`, tests al lado,
`docs/adr/0009-asistente-de-solo-lectura-con-herramientas-tipadas.md`.

Modificados: `src/app/(app)/layout.tsx`, `src/features/tablero/{queries,reglas,types}.ts`,
`.env.example`, `.env.local`, `CLAUDE.md`, `package.json`.

## Pruebas

Unitarias: config, esquemas, formateo del estado a texto, rechazo a no-admin,
panel abre/cierra/carga/error. La llamada real a Groq se prueba a mano con el
seed. CI no necesita la llave.
