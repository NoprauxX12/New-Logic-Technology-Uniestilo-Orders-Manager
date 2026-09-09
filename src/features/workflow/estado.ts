import {
  buscarCheckpoint,
  ETIQUETAS_ROL,
  type Checkpoint,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { siguienteCheckpoint } from "@/features/workflow/transiciones";

/**
 * El estado de una orden no se guarda en ninguna columna: se deriva de sus
 * avances (regla 1). Esto traduce esa derivación a lo que se lee en pantalla,
 * para que ni la etiqueta de un checkpoint ni el nombre de un rol se escriban
 * por segunda vez en la aplicación (regla 4).
 *
 * Pura, sin base de datos: recibe lo que la orden ya tiene marcado.
 */

export type LoQueSigue = {
  checkpoint: Checkpoint;
  /** El rol dueño, como se le muestra a una persona. */
  responsable: string;
};

/**
 * Qué falta por marcar y a quién le toca. `null` cuando la orden ya recorrió
 * todo el flujo.
 */
export function loQueSigue(
  marcados: readonly CheckpointId[],
): LoQueSigue | null {
  const siguiente = siguienteCheckpoint(marcados);
  if (!siguiente) return null;

  const checkpoint = buscarCheckpoint(siguiente);
  return { checkpoint, responsable: ETIQUETAS_ROL[checkpoint.rolDueno] };
}
