import type { CheckpointId, Rol } from "@/features/workflow/checkpoints";
import { puedeMarcar } from "@/features/workflow/transiciones";

export type ResultadoValidacion =
  { permitido: true } | { permitido: false; mensaje: string };

type DatosMarcacionCorte = {
  ordenExiste: boolean;
  checkpointsCompletados: readonly CheckpointId[];
  /** El rol de quien está marcando. El motor decide si es el dueño de corte. */
  rol: Rol;
};

/**
 * HU-08 · Determina si una orden puede marcarse como corte completado.
 * Esta función no consulta la base de datos: recibe la situación actual
 * y devuelve la decisión. Esto permite probar la regla fácilmente.
 */
export function validarMarcacionCorte({
  ordenExiste,
  checkpointsCompletados,
  rol,
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
    rol,
  });
}
