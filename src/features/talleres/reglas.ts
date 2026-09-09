import {
  buscarCheckpoint,
  type CheckpointId,
} from "@/features/workflow/checkpoints";

/**
 * HU-10 · Reglas del despacho a taller.
 *
 * Un lote es entidad propia y no un checkpoint (regla 6), así que estas reglas
 * no las puede responder el motor de workflow: no hay transición que validar.
 * Viven aquí, puras y sin base de datos, para poder probarlas sin levantar nada.
 */

/** Sin esto marcado, no hay nada que mandar al taller. */
export const CHECKPOINT_REQUERIDO: CheckpointId = "corte_completado";

export type ResultadoDespacho =
  { permitido: true } | { permitido: false; mensaje: string };

/** Lo mínimo que hay que saber de un lote para saber si sigue afuera. */
export type LoteEnviado = { recibido: boolean };

/**
 * ¿Se puede mandar un lote de esta orden a un taller?
 *
 * Se puede despachar más de una vez: una orden se reparte entre varios talleres
 * (regla 6). Lo único que se exige es que el corte esté hecho.
 */
export function puedeDespachar(
  marcados: readonly CheckpointId[],
): ResultadoDespacho {
  if (marcados.includes(CHECKPOINT_REQUERIDO)) {
    return { permitido: true };
  }

  const { etiqueta } = buscarCheckpoint(CHECKPOINT_REQUERIDO);
  return {
    permitido: false,
    mensaje: `Antes hay que marcar "${etiqueta}".`,
  };
}

/** Los lotes que todavía están en el taller, sin confirmar su recepción. */
export function lotesEnTaller<T extends LoteEnviado>(lotes: readonly T[]): T[] {
  return lotes.filter((lote) => !lote.recibido);
}

/**
 * Cómo se lee el estado de la orden en cuanto a talleres. El estado no se
 * guarda en ninguna columna (regla 1): se deriva de los lotes.
 */
export function describirEstadoDeTalleres(
  lotes: readonly LoteEnviado[],
): string {
  if (lotes.length === 0) return "Todavía no ha salido a ningún taller.";

  const afuera = lotesEnTaller(lotes).length;

  if (afuera === 0) return "Todo el trabajo volvió del taller.";
  if (afuera === 1 && lotes.length === 1) return "En confección.";

  return `En confección · ${afuera} de ${lotes.length} lotes todavía en taller.`;
}
