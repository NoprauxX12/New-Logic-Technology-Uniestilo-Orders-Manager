import { z } from "zod";

/**
 * HU-13 · Validación de lo que se reporta al cerrar una orden.
 *
 * Hay un esquema por forma de entrada: los dos reportes que solo se marcan, el
 * de la factura que además trae su número, y el cierre.
 *
 * Ninguno pide quién reporta: eso sale de la sesión (HU-16) y no de un campo
 * del formulario, que cualquiera podría cambiar para firmar a nombre de otra
 * persona (RNF-05).
 *
 * `guid` y no `uuid`: los identificadores del seed son legibles a propósito
 * (`…-0000000000f6`) y no cumplen la versión que exige la RFC 4122, que es lo
 * que valida `z.uuid()`. Lo que hace falta aquí es la forma, no el canon.
 */

const ordenId = z.guid({ error: "No se sabe de qué orden es este reporte" });

/** Las dos cosas que solo se reportan, sin ningún dato más. */
export const reporteSimpleSchema = z.object({
  ordenId,
  reporte: z.enum(["etiquetas", "documentos_despacho"], {
    error: "Ese reporte no existe",
  }),
});

export const facturaSchema = z.object({
  ordenId,
  // El sistema no factura (regla 8): solo guarda el número de la factura que se
  // generó en el sistema externo de Uniestilo.
  numeroFactura: z
    .string()
    .trim()
    .min(1, "Escribe el número de la factura")
    .max(50, "El número de la factura es muy largo"),
});

export const cierreSchema = z.object({
  ordenId,
});

export type ReporteSimple = z.infer<typeof reporteSimpleSchema>;
export type ReporteFactura = z.infer<typeof facturaSchema>;
export type CierreDeOrden = z.infer<typeof cierreSchema>;
