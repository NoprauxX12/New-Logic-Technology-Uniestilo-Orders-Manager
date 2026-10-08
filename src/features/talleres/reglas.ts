import {
  buscarCheckpoint,
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";
import type { LoteEnviado } from "@/lib/talleres/estadoLotes";

/**
 * HU-10 · Reglas del despacho a taller.
 *
 * Un lote es entidad propia y no un checkpoint (regla 6), así que estas reglas
 * no las puede responder el motor de workflow: no hay transición que validar.
 * Viven aquí, puras y sin base de datos, para poder probarlas sin levantar nada.
 */

/** Sin esto marcado, no hay nada que mandar al taller. */
export const CHECKPOINT_REQUERIDO: CheckpointId = "corte_completado";

/** El único rol que despacha y recibe lotes. */
export const ROL_DE_TALLERES: Rol = "logistica";

export type ResultadoDespacho =
  { permitido: true } | { permitido: false; mensaje: string };

function rolNoAutorizado(): ResultadoDespacho {
  return {
    permitido: false,
    mensaje: `Los lotes a taller los maneja ${ETIQUETAS_ROL[ROL_DE_TALLERES]}.`,
  };
}

/**
 * ¿Puede esta persona mandar un lote de esta orden a un taller?
 *
 * Se puede despachar más de una vez: una orden se reparte entre varios talleres
 * (regla 6). Se exige que el corte esté hecho y que quien despacha sea de
 * logística; el rol sale de la sesión, nunca del formulario.
 */
export function puedeDespachar(
  marcados: readonly CheckpointId[],
  rol: Rol,
): ResultadoDespacho {
  if (rol !== ROL_DE_TALLERES) return rolNoAutorizado();

  if (marcados.includes(CHECKPOINT_REQUERIDO)) {
    return { permitido: true };
  }

  const { etiqueta } = buscarCheckpoint(CHECKPOINT_REQUERIDO);
  return {
    permitido: false,
    mensaje: `Antes hay que marcar "${etiqueta}".`,
  };
}

/**
 * HU-11 · Reglas de la recepción de un lote.
 *
 * Igual que el despacho: un lote no es un checkpoint (regla 6), así que esto
 * no lo decide el motor de workflow. "La orden fue despachada antes" (criterio
 * de aceptación) se cumple con que el lote exista: no hay recepción sin un
 * lote que la haya originado.
 */
export function puedeConfirmarRecepcion(
  lote: LoteEnviado | undefined,
  rol: Rol,
): ResultadoDespacho {
  if (rol !== ROL_DE_TALLERES) return rolNoAutorizado();

  if (!lote) {
    return {
      permitido: false,
      mensaje: "Ese lote no pertenece a esta orden.",
    };
  }

  if (lote.recibido) {
    return {
      permitido: false,
      mensaje: "Ya se confirmó la recepción de este lote.",
    };
  }

  return { permitido: true };
}
