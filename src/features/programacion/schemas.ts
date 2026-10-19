import { z } from "zod";

import { MAXIMO_POR_HOJA } from "@/features/programacion/reglas";

/**
 * Validación de lo que entra a programar órdenes hacia diseño (HU-03).
 *
 * Una Server Action se puede invocar con un POST directo, sin pasar por la
 * pantalla, así que lo que llega se valida antes de tocar la base.
 *
 * Lo único que viaja es la lista de órdenes en el orden en que deben
 * trabajarse: el número de la hoja y el turno de cada una los pone el sistema.
 */
export const programarOrdenesSchema = z.object({
  /** El orden del arreglo es el orden en que diseño debe trabajarlas. */
  ordenes: z
    .array(
      // `z.guid` y no `z.uuid`: este último exige los dígitos de versión y
      // variante de la RFC, que los ids del seed no tienen.
      z.guid({ error: "No se pudo identificar una de las órdenes" }),
    )
    .min(1, "Agrega al menos una orden a la programación")
    .max(
      MAXIMO_POR_HOJA,
      `En una programación caben hasta ${MAXIMO_POR_HOJA} órdenes`,
    ),
});

export type EntradaProgramarOrdenes = z.infer<typeof programarOrdenesSchema>;
