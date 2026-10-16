import { z } from "zod";

/**
 * Validación de lo que entra a programar órdenes hacia diseño (HU-03).
 *
 * Una Server Action se puede invocar con un POST directo, sin pasar por la
 * pantalla, así que lo que llega se valida antes de tocar la base.
 *
 * No hay máximo de órdenes: la historia habla de cinco o seis porque es lo que
 * suele caber en la hoja, no porque sea un tope. Lo que sí es obligatorio es
 * que venga al menos una y que cada una traiga su número.
 */

/**
 * `z.guid` y no `z.uuid`: este último exige los dígitos de versión y variante
 * de la RFC, que los ids del seed (`00000000-…-0000000000f1`) no tienen.
 */
const ordenId = z.guid({ error: "No se pudo identificar una de las órdenes" });

export const ordenProgramadaSchema = z.object({
  ordenId,
  numeroOrdenProgramacion: z
    .string()
    .trim()
    .min(1, "Escribe el número de programación")
    .max(30, "El número de programación es demasiado largo"),
});

export const programarOrdenesSchema = z.object({
  /** El orden del arreglo es el orden en que diseño debe trabajarlas. */
  programaciones: z
    .array(ordenProgramadaSchema)
    .min(1, "Agrega al menos una orden a la programación"),
});

export type EntradaOrdenProgramada = z.infer<typeof ordenProgramadaSchema>;
export type EntradaProgramarOrdenes = z.infer<typeof programarOrdenesSchema>;
