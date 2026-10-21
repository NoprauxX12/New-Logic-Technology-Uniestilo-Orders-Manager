import { z } from "zod";

import {
  esEtapaDeEntrada,
  MOTIVO_MAXIMO,
  TALLAS_MAXIMO,
} from "@/features/correcciones/reglas";
import { CHECKPOINTS } from "@/features/workflow/checkpoints";
import { hoyEnBogota } from "@/lib/utils/fechas";

/**
 * HU-18 · Validación de las dos salidas ante un defecto.
 *
 * Las usan el formulario y la server action. Los mensajes se le muestran a
 * alguien del taller: dicen qué hacer, no qué falló.
 */

const IDS_CHECKPOINT = CHECKPOINTS.map((checkpoint) => checkpoint.id);

// `z.guid` y no `z.uuid`: los ids del seed no cumplen los dígitos de versión
// de la RFC (ver `workflow/schemas.ts`).
const idDeOrden = z.guid("No se pudo identificar la orden");

function motivo(vacio: string) {
  return z
    .string()
    .trim()
    .min(1, vacio)
    .max(
      MOTIVO_MAXIMO,
      `El motivo es muy largo (máximo ${MOTIVO_MAXIMO} letras)`,
    );
}

// ---------------------------------------------------------------------------
// Devolver la orden a una etapa
// ---------------------------------------------------------------------------

export const devolverOrdenSchema = z.object({
  ordenId: idDeOrden,
  checkpoint: z.enum(IDS_CHECKPOINT, "Elige a qué etapa se devuelve la orden"),
  motivo: motivo("Escribe por qué se devuelve la orden"),
});

export type EntradaDevolverOrden = z.infer<typeof devolverOrdenSchema>;

// ---------------------------------------------------------------------------
// Orden de corrección
// ---------------------------------------------------------------------------

const cantidadDefectuosa = z
  .string()
  .trim()
  .min(1, "Escribe cuántas prendas salieron mal")
  .transform(Number)
  .pipe(
    z
      .number({ error: "La cantidad debe ser un número" })
      .int("La cantidad debe ser un número entero, sin decimales")
      .positive("La cantidad debe ser mayor que cero"),
  );

const tallasDefectuosas = z
  .string()
  .trim()
  .min(1, "Escribe qué tallas son, por ejemplo: S:8, M:4")
  .max(TALLAS_MAXIMO, "El detalle de tallas es muy largo");

export const prendaDefectuosaSchema = z.object({
  itemId: z.guid("No se pudo identificar la prenda"),
  cantidad: cantidadDefectuosa,
  tallas: tallasDefectuosas,
});

export const ordenCorreccionSchema = z.object({
  ordenOriginalId: idDeOrden,
  fechaEntrega: z.iso
    .date({ error: "Escoge la fecha de entrega" })
    .refine((fecha) => fecha >= hoyEnBogota(), {
      error: "La fecha de entrega no puede ser anterior a hoy",
    }),
  motivo: motivo("Escribe qué defecto tienen las prendas"),
  etapaInicial: z
    .string()
    .refine(esEtapaDeEntrada, "Elige por qué etapa entra la corrección"),
  items: z
    .array(prendaDefectuosaSchema)
    .min(1, "Elige al menos una prenda defectuosa"),
});

export type EntradaOrdenCorreccion = z.infer<typeof ordenCorreccionSchema>;
