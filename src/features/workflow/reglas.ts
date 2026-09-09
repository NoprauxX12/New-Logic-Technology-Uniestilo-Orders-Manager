import type { CheckpointId } from "@/features/workflow/checkpoints";
import { puedeMarcar } from "@/features/workflow/transiciones";

export type ResultadoValidacion =
  { permitido: true } | { permitido: false; mensaje: string };

type DatosMarcacionCorte = {
  ordenExiste: boolean;
  checkpointsCompletados: readonly CheckpointId[];
};

/**
 * HU-08 · Determina si una orden puede marcarse como corte completado.
 * Esta función no consulta la base de datos: recibe la situación actual
 * y devuelve la decisión. Esto permite probar la regla fácilmente.
 */
export function validarMarcacionCorte({
  ordenExiste,
  checkpointsCompletados,
}: DatosMarcacionCorte): ResultadoValidacion {
  if (!ordenExiste) {
    return {
      permitido: false,
      mensaje: "La orden indicada no existe.",
    };
  }

  return puedeMarcar({
    checkpoint: "corte_completado",
    marcados: checkpointsCompletados,
    rol: "corte",
  });

  return { permitido: true };
}
