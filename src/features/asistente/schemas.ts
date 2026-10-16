import { z } from "zod";

/**
 * HU-15 · Lo que el panel manda a la action: la conversación completa, con el
 * último mensaje escrito por la persona. Se valida en el borde antes de tocar
 * la base o el modelo.
 */

export const MAX_LARGO_MENSAJE = 2000;
export const MAX_MENSAJES_ENVIADOS = 200;

export const mensajeChatSchema = z.object({
  rol: z.enum(["usuario", "asistente"]),
  contenido: z
    .string()
    .trim()
    .min(1, "Escribe una pregunta.")
    .max(MAX_LARGO_MENSAJE, "La pregunta es demasiado larga."),
});

export const conversacionSchema = z
  .array(mensajeChatSchema)
  .min(1, "Escribe una pregunta.")
  .max(MAX_MENSAJES_ENVIADOS, "La conversación es demasiado larga.")
  .refine((mensajes) => mensajes[mensajes.length - 1]?.rol === "usuario", {
    message: "El último mensaje debe ser una pregunta tuya.",
  });

export type Conversacion = z.infer<typeof conversacionSchema>;
