import { z } from "zod";

export const itemTelaSchema = z.object({
  itemId: z.uuid({ error: "No se pudo identificar la prenda" }),

  tipoTela: z
    .string()
    .trim()
    .min(1, "Escribe el tipo de tela")
    .max(200, "El tipo de tela es muy largo"),

  cantidadTela: z
    .string()
    .trim()
    .min(1, "Escribe la cantidad de tela")
    .regex(/^\d+([.,]\d{1,2})?$/, "Usa un número con máximo dos decimales")
    .transform((valor) => Number(valor.replace(",", ".")))
    .pipe(
      z
        .number()
        .positive("La cantidad debe ser mayor que cero")
        .max(99999999.99, "La cantidad de tela es demasiado grande"),
    ),

  unidadTela: z.enum(["metros", "kilos"], {
    error: "Selecciona metros o kilos",
  }),

  observacionesTela: z
    .string()
    .trim()
    .max(1000, "Las observaciones son muy largas")
    .optional(),
});

export const programarTelaSchema = z.object({
  ordenId: z.uuid({ error: "No se pudo identificar la orden" }),

  items: z
    .array(itemTelaSchema)
    .min(1, "La orden debe tener al menos una prenda")
    .refine(
      (items) =>
        new Set(items.map((item) => item.itemId)).size === items.length,
      "Hay prendas repetidas en el formulario",
    ),
});

export type ProgramarTela = z.infer<typeof programarTelaSchema>;
