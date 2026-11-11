import { z } from "zod";

/**
 * HU-15 · Lo que el panel manda a la action: la conversación completa, con el
 * último mensaje escrito por la persona. Se valida en el borde antes de tocar
 * la base o el modelo.
 */

export const MAX_LARGO_MENSAJE = 2000;
/**
 * Lo que puede medir una respuesta del asistente que vuelve en la conversación.
 * Es más que una pregunta porque el resumen proactivo (HU-21) lista varias
 * órdenes con sus enlaces; con el tope de la pregunta, la primera pregunta
 * después del resumen se rechazaría.
 */
export const MAX_LARGO_RESPUESTA = 8000;
export const MAX_MENSAJES_ENVIADOS = 200;

export const mensajeChatSchema = z.discriminatedUnion("rol", [
  z.object({
    rol: z.literal("usuario"),
    contenido: z
      .string()
      .trim()
      .min(1, "Escribe una pregunta.")
      .max(MAX_LARGO_MENSAJE, "La pregunta es demasiado larga."),
  }),
  z.object({
    rol: z.literal("asistente"),
    contenido: z
      .string()
      .trim()
      .min(1)
      .max(MAX_LARGO_RESPUESTA, "La conversación es demasiado larga."),
  }),
]);

export const conversacionSchema = z
  .array(mensajeChatSchema)
  .min(1, "Escribe una pregunta.")
  .max(MAX_MENSAJES_ENVIADOS, "La conversación es demasiado larga.")
  .refine((mensajes) => mensajes[mensajes.length - 1]?.rol === "usuario", {
    message: "El último mensaje debe ser una pregunta tuya.",
  });

export type Conversacion = z.infer<typeof conversacionSchema>;
