import type { CheckpointId } from "@/features/workflow/checkpoints";
import { puedeMarcar } from "@/features/workflow/transiciones";

export type ResultadoValidacionMarcacion =
  { permitido: true } | { permitido: false; mensaje: string };

type DatosLlegadaMarcacion = {
  ordenExiste: boolean;
  recepcionConfirmada: boolean;
  checkpointsCompletados: readonly CheckpointId[];
};

/**
 * HU-12 · Determina si una orden puede marcarse como llegada a marcación.
 */
export function validarLlegadaMarcacion({
  ordenExiste,
  recepcionConfirmada,
  checkpointsCompletados,
}: DatosLlegadaMarcacion): ResultadoValidacionMarcacion {
  if (!ordenExiste) {
    return {
      permitido: false,
      mensaje: "La orden indicada no existe.",
    };
  }

  if (!recepcionConfirmada) {
    return {
      permitido: false,
      mensaje: "Logística debe confirmar primero la recepción de las prendas.",
    };
  }

  return puedeMarcar({
    checkpoint: "llegada_marcacion",
    marcados: checkpointsCompletados,
    rol: "marcacion",
  });
}
