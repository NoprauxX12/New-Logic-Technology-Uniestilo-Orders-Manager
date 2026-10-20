import { z } from "zod";

import {
  armarTextoTallas,
  esTallaje,
  sumarTallas,
  TALLAJE_OTRO,
  TALLAJES,
} from "@/lib/ordenes/tallas";

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

const descripcionPrenda = z
  .string()
  .trim()
  .min(1, "Escribe qué prenda es")
  .max(300, "La descripción es muy larga");

/** Las tallas escritas a mano, para el tallaje "otro". */
const tallasEscritas = z
  .string()
  .trim()
  .min(1, "Escribe las tallas, por ejemplo: S:20, M:40, L:30")
  .max(300, "El detalle de tallas es muy largo");

const observacionesPrenda = z
  .string()
  .trim()
  .max(1000, "Las observaciones son muy largas")
  .optional();

/** Cuántas prendas de una talla: entero de cero para arriba. */
const cantidadDeUnaTalla = z
  .string()
  .trim()
  .regex(/^\d{0,6}$/, "Las cantidades de cada talla son números enteros")
  .transform((texto) => (texto === "" ? 0 : Number(texto)));

/**
 * Una prenda de la orden.
 *
 * Llega con todos los campos como texto suelto y se valida entera en la
 * transformación, no campo por campo: lo que se pide depende del tallaje.
 * Validar todo ahí también hace que se señalen todos los errores de una vez, y
 * no uno por intento.
 *
 * - Con un tallaje del catálogo, la persona llena la cantidad de cada talla; la
 *   cantidad de la prenda es la suma, nunca se escribe, y las tallas se arman
 *   en el formato de siempre (`S:20, M:40`).
 * - Con "otro", o sin `tallaje` (quien llama sin pasar por el formulario), la
 *   cantidad y las tallas se escriben a mano, como antes.
 */
export const itemOrdenSchema = z
  .object({
    descripcion: z.string(),
    tallaje: z.string().trim().optional(),
    cantidad: z.string().optional(),
    tallas: z.string().optional(),
    /** Cantidad de cada talla, con la talla como clave. Solo si hay tallaje. */
    cantidadesPorTalla: z.record(z.string(), z.string()).optional(),
    valor: z.string(),
    observaciones: z.string().optional(),
  })
  .transform((item, ctx) => {
    let hayError = false;

    function falla(campo: string, mensaje: string) {
      hayError = true;
      ctx.addIssue({ code: "custom", message: mensaje, path: [campo] });
    }

    /** Valida un campo con su esquema y pasa los mensajes al campo. */
    function validar<T>(esquema: z.ZodType<T>, valor: unknown, campo: string) {
      const resultado = esquema.safeParse(valor);
      if (resultado.success) return resultado.data;
      for (const problema of resultado.error.issues) {
        falla(campo, problema.message);
      }
      return undefined;
    }

    const descripcion = validar(
      descripcionPrenda,
      item.descripcion,
      "descripcion",
    );
    const valor = validar(valorEnPesos, item.valor, "valor");
    const observaciones = validar(
      observacionesPrenda,
      item.observaciones,
      "observaciones",
    );

    const tallaje = item.tallaje === undefined ? TALLAJE_OTRO : item.tallaje;
    let cantidad: number | undefined;
    let tallas: string | undefined;

    if (tallaje === TALLAJE_OTRO) {
      cantidad = validar(cantidadPrendas, item.cantidad ?? "", "cantidad");
      tallas = validar(tallasEscritas, item.tallas ?? "", "tallas");
    } else if (esTallaje(tallaje)) {
      const permitidas: readonly string[] = TALLAJES[tallaje].tallas;
      const porTalla: Record<string, number> = {};
      let tallasConError = false;

      for (const [talla, texto] of Object.entries(
        item.cantidadesPorTalla ?? {},
      )) {
        if (!permitidas.includes(talla)) {
          tallasConError = true;
          falla("tallas", `La talla ${talla} no es de este tallaje`);
          continue;
        }
        const numero = validar(cantidadDeUnaTalla, texto, "tallas");
        if (numero === undefined) tallasConError = true;
        else porTalla[talla] = numero;
      }

      const total = sumarTallas(porTalla);

      if (!tallasConError && total <= 0) {
        tallasConError = true;
        falla("tallas", "Escribe cuántas prendas hay en al menos una talla");
      }

      if (!tallasConError) {
        cantidad = total;
        tallas = armarTextoTallas(tallaje, porTalla);
      }
    } else {
      falla("tallaje", "Elige para qué tipo de prenda son las tallas");
    }

    if (
      hayError ||
      descripcion === undefined ||
      valor === undefined ||
      cantidad === undefined ||
      tallas === undefined
    ) {
      return z.NEVER;
    }

    return { descripcion, cantidad, tallas, tallaje, valor, observaciones };
  });

export const nuevaOrdenSchema = z
  .object({
    // Identifica la orden. La base impide que se repita, sin distinguir
    // mayúsculas: `OC-A-650225` y `oc-a-650225` son el mismo número.
    numeroOrdenCompra: z
      .string()
      .trim()
      .min(1, "Escribe el número de la orden de compra")
      .max(50, "El número de orden de compra es muy largo"),

    // Datos del cliente. El NIT dice de quién es la orden: si ya existe, se
    // reutiliza ese cliente. La comparación ignora puntos, guiones y espacios,
    // así que `900.123.456-7` y `9001234567` son el mismo cliente.
    nit: z
      .string()
      .trim()
      .min(1, "Escribe el NIT del cliente")
      .max(20, "El NIT es muy largo")
      .regex(/^[0-9.\-\s]+$/, "El NIT solo lleva números, puntos y guiones")
      // Sin esto, un NIT de puros separadores ("....." ) pasaba la validación.
      // Como es la llave del cliente, todo lo que se registrara así se pegaba
      // al mismo cliente vacío.
      .refine(
        (valor) => valor.replace(/[^0-9]/g, "").length >= 5,
        "El NIT debe tener al menos 5 números",
      ),
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
