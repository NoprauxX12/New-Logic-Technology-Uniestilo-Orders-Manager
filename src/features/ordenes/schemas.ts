import { z } from "zod";

/**
 * HU-01 · Validación del registro de una nueva orden.
 *
 * Lo usan el formulario y la server action, para que las reglas se escriban
 * una sola vez. Los valores llegan como texto (vienen de un formulario HTML),
 * así que los campos numéricos se validan como texto y se convierten aquí.
 *
 * Los mensajes se le muestran a alguien del taller: sin jerga y diciendo qué
 * hacer, no qué falló.
 */

/** Cantidad de prendas: entero mayor que cero. */
const cantidadPrendas = z
  .string()
  .trim()
  .min(1, "Escribe cuántas prendas son")
  .transform(Number)
  .pipe(
    z
      .number({ error: "La cantidad debe ser un número" })
      .int("La cantidad debe ser un número entero, sin decimales")
      .positive("La cantidad debe ser mayor que cero"),
  );

/** Valor en pesos: acepta decimales, no acepta negativos. */
const valorEnPesos = z
  .string()
  .trim()
  .min(1, "Escribe el valor")
  .transform(Number)
  .pipe(
    z
      .number({ error: "El valor debe ser un número" })
      .nonnegative("El valor no puede ser negativo"),
  );

export const itemOrdenSchema = z.object({
  descripcion: z
    .string()
    .trim()
    .min(1, "Escribe qué prenda es")
    .max(300, "La descripción es muy larga"),
  cantidad: cantidadPrendas,
  tallas: z
    .string()
    .trim()
    .min(1, "Escribe las tallas, por ejemplo: S:20, M:40, L:30")
    .max(300, "El detalle de tallas es muy largo"),
  valor: valorEnPesos,
  observaciones: z
    .string()
    .trim()
    .max(1000, "Las observaciones son muy largas")
    .optional(),
});

export const nuevaOrdenSchema = z
  .object({
    // Identifica la orden. La base impide que se repita (restricción unique).
    numeroOrdenCompra: z
      .string()
      .trim()
      .min(1, "Escribe el número de la orden de compra")
      .max(50, "El número de orden de compra es muy largo"),

    // Datos del cliente. Si el NIT ya existe, se reutiliza ese cliente.
    nit: z
      .string()
      .trim()
      .min(5, "Escribe el NIT del cliente")
      .max(20, "El NIT es muy largo")
      .regex(/^[0-9.\-\s]+$/, "El NIT solo lleva números, puntos y guiones"),
    razonSocial: z
      .string()
      .trim()
      .min(1, "Escribe la razón social del cliente")
      .max(200, "La razón social es muy larga"),
    contactoNombre: z
      .string()
      .trim()
      .min(1, "Escribe el nombre de la persona de contacto")
      .max(150, "El nombre es muy largo"),
    contactoCelular: z
      .string()
      .trim()
      .min(7, "Escribe el número de celular")
      .max(20, "El número de celular es muy largo")
      .regex(
        /^[0-9+\-\s()]+$/,
        "El celular solo lleva números, espacios y los signos + - ( )",
      ),

    fechaIngreso: z.iso.date({
      error: "Escoge la fecha en que entró el pedido",
    }),
    fechaEntrega: z.iso.date({ error: "Escoge la fecha de entrega" }),

    observaciones: z
      .string()
      .trim()
      .max(2000, "Las observaciones son muy largas")
      .optional(),

    items: z.array(itemOrdenSchema).min(1, "Agrega al menos una prenda"),
  })
  // Criterio de aceptación de HU-01. Las fechas son ISO (2026-09-07), así que
  // compararlas como texto da el mismo resultado que compararlas como fechas.
  .refine((orden) => orden.fechaEntrega >= orden.fechaIngreso, {
    error: "La fecha de entrega no puede ser anterior a la fecha de ingreso",
    path: ["fechaEntrega"],
  });

/** Datos ya validados y convertidos: cantidad y valor salen como números. */
export type NuevaOrden = z.infer<typeof nuevaOrdenSchema>;

/** Una prenda de la orden, ya validada. */
export type ItemOrden = z.infer<typeof itemOrdenSchema>;
