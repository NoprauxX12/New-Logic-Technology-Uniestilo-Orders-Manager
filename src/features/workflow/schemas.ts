import { z } from "zod";

import { CHECKPOINTS } from "@/features/workflow/checkpoints";

/**
 * Validación de lo que entra a marcar un avance.
 *
 * Una Server Action se puede invocar con un POST directo, sin pasar por el
 * botón, así que lo que llega se valida antes de tocar la base. Los valores
 * aceptados salen de `CHECKPOINTS`, no de una lista escrita aparte (regla 4).
 *
 * Estos mensajes no los corrige nadie escribiendo —si aparecen es por un enlace
 * viejo o una manipulación—, así que dicen qué pasó en lenguaje del taller y
 * mandan a la persona a donde sí puede seguir.
 */

const IDS_CHECKPOINT = CHECKPOINTS.map((checkpoint) => checkpoint.id);

export const marcarAvanceSchema = z.object({
  // `z.guid` y no `z.uuid`: este último exige un UUID conforme a la RFC, con
  // sus dígitos de versión y variante. Los ids del seed
  // (`00000000-0000-0000-0000-0000000000f5`) no los tienen, así que con `uuid`
  // ningún marcado sobre datos de prueba pasaría de aquí.
  ordenId: z.guid("No se pudo identificar la orden"),
  checkpoint: z.enum(IDS_CHECKPOINT, "No se reconoce ese paso del proceso"),
});

/** Lo que la action recibe, ya validado. */
export type EntradaMarcarAvance = z.infer<typeof marcarAvanceSchema>;
