import { z } from "zod";

import {
  esTipoInsumo,
  MAXIMO_DETALLE,
  type TipoInsumo,
} from "@/features/insumos/catalogo";

/**
 * HU-23 · Lo que la action acepta para validar los insumos de una orden. Lo
 * comparten el formulario y la action; la base repite las mismas reglas en
 * `validar_insumos`.
 */

export const insumoDelListadoSchema = z.object({
  insumo: z
    .string()
    .refine((valor): valor is TipoInsumo => esTipoInsumo(valor), {
      error: "Uno de los insumos no es de la lista",
    }),

  detalle: z
    .string()
    .trim()
    .min(1, "Escribe cuánto y cómo de cada insumo que marcaste")
    .max(MAXIMO_DETALLE, `El detalle va hasta ${MAXIMO_DETALLE} caracteres`),
});

export const validarInsumosSchema = z.object({
  // `guid` y no `uuid`: los ids del seed no son RFC 4122 (como en workflow).
  ordenId: z.guid({ error: "No se pudo identificar la orden" }),

  insumos: z
    .array(insumoDelListadoSchema)
    .min(1, "Marca al menos un insumo de la orden")
    .refine(
      (insumos) =>
        new Set(insumos.map((item) => item.insumo)).size === insumos.length,
      "Un insumo está dos veces en el listado",
    ),
});

export type ValidarInsumos = z.infer<typeof validarInsumosSchema>;
