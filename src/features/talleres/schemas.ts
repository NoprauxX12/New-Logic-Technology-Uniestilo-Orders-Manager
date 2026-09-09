import { z } from "zod";

/**
 * HU-10 · Validación del despacho de un lote a un taller satélite.
 *
 * Lo usan el formulario y la server action, para que las reglas se escriban una
 * sola vez. Los mensajes se los lee alguien de logística: dicen qué hacer, no
 * qué falló.
 *
 * El `trim()` va antes del `min(1)` a propósito: así un taller escrito con puros
 * espacios cuenta como vacío, que es el criterio de aceptación de la historia.
 */
export const despacharLoteSchema = z.object({
  // `guid` y no `uuid`: los identificadores del seed no cumplen la versión ni la
  // variante que exige la RFC 4122 —son legibles a propósito, como
  // `…-0000000000f3`—, y `z.uuid()` los rechaza. Lo que hace falta aquí es que
  // sea un identificador con la forma correcta, no que sea un UUID canónico.
  ordenId: z.guid({ error: "No se sabe a qué orden pertenece este despacho" }),

  // Texto libre: el catálogo de talleres satélite sigue pendiente en CLAUDE.md.
  taller: z
    .string()
    .trim()
    .min(1, "Escribe a qué taller se envió el lote")
    .max(200, "El nombre del taller es muy largo"),

  descripcionPrendas: z
    .string()
    .trim()
    .min(1, "Escribe qué prendas se enviaron")
    .max(1000, "La descripción de las prendas es muy larga"),

  // Quién despacha. Mientras no exista el login (HU-16) se escoge de una lista
  // de usuarios de logística; después saldrá de la sesión y este campo se va.
  enviadoPor: z.guid({ error: "Escoge quién hace el despacho" }),
});

/** Datos ya validados y sin espacios sobrantes. */
export type DespachoLote = z.infer<typeof despacharLoteSchema>;
