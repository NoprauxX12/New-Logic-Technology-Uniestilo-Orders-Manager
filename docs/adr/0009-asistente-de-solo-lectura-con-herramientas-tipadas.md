# 0009. Asistente de solo lectura con herramientas tipadas sobre Groq

Fecha: 2026-10-10 · Estado: Aceptada

## Contexto

HU-15 pide que administración le pregunte al sistema en lenguaje natural por el estado de un pedido y reciba la información de la orden y su etapa. La regla 10 exige que la IA solo informe: no decide ni muta. CLAUDE.md dejaba el proveedor de LLM sin definir y pedía aislarlo detrás de `src/lib/ai/` (RNF-12).

Había que decidir tres cosas: qué proveedor y SDK, cómo accede el modelo a los datos sin poder escribir, y por dónde viaja la pregunta.

## Decisión

**Groq, a través del Vercel AI SDK.** `ai` es la capa neutra (mensajes, herramientas, ciclo de tool-calling) y `@ai-sdk/groq` el proveedor. Solo `src/lib/ai/proveedor.ts` importa el paquete del proveedor; el resto de la aplicación usa `responderConHerramientas()` y `herramienta()` de `@/lib/ai`. Cambiar de proveedor es un caso nuevo en ese archivo y un valor en `IA_PROVEEDOR`. Modelo por defecto `llama-3.3-70b-versatile`, de producción en Groq y con tool use.

**Herramientas tipadas, no SQL generado ni MCP.** El modelo no escribe consultas: solo puede llamar tres funciones con entrada validada por zod (`buscarOrdenes`, `estadoDeOrden`, `resumenOrdenes`), que ejecutan las mismas lecturas del tablero con el cliente de Supabase de la sesión de quien pregunta. El solo-lectura queda garantizado por construcción: no existe herramienta que escriba. Se descartó un servidor MCP contra Postgres porque es un proceso aparte que no cabe en Vercel y porque su "solo lectura" dependería de un rol de base o de filtrar SQL.

**Server Action sin streaming.** `preguntarAlAsistente` es una action, no un route handler, porque ahí vive la lógica de la aplicación y la convención reserva `app/api` para webhooks, cron y health. Groq responde en uno o dos segundos y la falta de efecto de tipeo no se nota.

**Contexto en el navegador.** La conversación vive en el estado del panel y se manda completa en cada pregunta; la capa de IA la recorta a `IA_MAX_MENSAJES_CONTEXTO` mensajes y `IA_MAX_CARACTERES_CONTEXTO` caracteres, porque el proveedor limita tokens por minuto y una conversación larga se los come. No hay tabla ni migración: al recargar se pierde.

**Configuración perezosa.** `leerConfigIA()` valida las variables `IA_*` al usarlas, no al cargar el módulo. El build no exige la llave y, si falta, el panel dice que el asistente no está configurado.

**Estado de la orden en `src/lib/ordenes/`.** La derivación que vivía en `features/tablero` (`queries.ts`, `reglas.ts`, `types.ts`) la necesitan dos features, así que se promovió a `lib/` (ADR 0003). El tablero importa de ahí sin cambiar de comportamiento.

## Consecuencias

- Autorización en dos capas también aquí: el layout monta el panel solo para `admin`, la action vuelve a comprobar el rol, y las herramientas leen bajo RLS.
- Las herramientas son el único contrato entre el modelo y los datos: HU-21 (atrasos y pendientes) se construye agregando o ampliando herramientas, no dándole más acceso al modelo.
- La llamada real al modelo no se prueba en CI; se prueban la configuración, los esquemas, el formateo de la orden, el ciclo de herramientas con un modelo doble y el panel.
- Si se quiere streaming, hay que abrir un route handler y documentar la excepción en un ADR nuevo.
- Las variables `IA_*` hay que cargarlas en Vercel; el proyecto arranca sin ellas pero el asistente no responde.
- Los esquemas de las herramientas son laxos a propósito (`z.string()` en vez de `z.uuid()`): Groq valida los argumentos contra el JSON Schema y un patrón estricto convierte un id que no sea RFC 4122 en un error 400 que tumba la respuesta entera.
- La capa de IA no reintenta: cuando el proveedor limita por minuto (HTTP 429) pide esperar más de lo que dura `IA_TIEMPO_MAXIMO_MS`, y un reintento solo convertía el "ocupado" en un "tardó demasiado" confuso. El fallo llega clasificado (`ocupado`, `tiempo`, `proveedor`) y la persona ve un mensaje distinto para cada uno.

## Ampliación: HU-21, el asistente señala sin que le pregunten

Fecha: 2026-11-10

HU-21 pide que el asistente le señale a administración, de forma proactiva, las órdenes atrasadas, las notificaciones pendientes y sugerencias de acciones, sin decidir por ella. Se construyó como lo previó este ADR: ampliando lo que el modelo puede leer, no dándole más acceso.

- **Lo pendiente se clasifica en el servidor, no en el modelo.** `clasificarPendientes()` (`src/lib/ordenes/pendientes.ts`, pura y con pruebas) separa las órdenes atrasadas, las en riesgo de entrega y las detenidas (sin avance vigente hace `DIAS_SIN_AVANCE_DETENIDA` = 3 días o más, en hora de Bogotá; sin avances cuenta desde el registro), cada una una sola vez y en su grupo más urgente, con el área donde está parada. Las cerradas no aparecen y las que están en un taller satélite no cuentan como detenidas: ahí el tiempo corre sin avances a propósito. Las alertas sin atender (tela de todos, entrega de la propia cuenta) se leen en `src/lib/alertas/`, de donde también las toma el tablero.
- **Las sugerencias las arma la aplicación.** `src/features/asistente/pendientes.ts` le pone a cada orden una sugerencia en condicional ("Podrías preguntarle a Corte…") con el área y la etapa reales. El modelo las redacta y prioriza, pero no las inventa; el prompt le prohíbe ordenar o decidir.
- **Resumen al abrir, una vez por carga.** La action `resumenProactivo()` lee y clasifica lo pendiente y le pasa los datos al modelo en el mensaje, sin herramientas, para que salga en una sola ronda. El panel lo pide la primera vez que se abre en la carga de la página y lo deja como primer mensaje de la conversación. Si no hay nada pendiente no se llama al modelo.
- **Respaldo sin IA.** Si el modelo no está configurado, falla o responde en blanco, la action devuelve `redactarResumenSinIA()` con los mismos datos y sugerencias. El asistente señala aunque el proveedor no responda.
- **Cuarta herramienta, `pendientesDelDia`.** La misma lectura, para preguntas como "¿qué tengo pendiente hoy?". Sigue siendo de solo lectura.
- **El botón muestra cuánto hay.** El layout de administración calcula con conteos livianos (`contarPorAtender()`: órdenes atrasadas más alertas sin atender) el número del botón flotante. Si el conteo falla, el botón sale sin número en vez de tumbar la pantalla.
- **Las respuestas pueden medir más que las preguntas.** Una respuesta del asistente que vuelve en la conversación admite hasta `MAX_LARGO_RESPUESTA` caracteres; con el tope de la pregunta, el resumen hacía rechazar la siguiente.
