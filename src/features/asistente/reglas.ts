import type { Rol } from "@/features/workflow/checkpoints";

/**
 * HU-15 · Quién puede hablar con el asistente: solo administración, que es
 * quien ve la totalidad de las órdenes (HU-14, HU-17). El layout lo usa para
 * decidir si monta el panel; la action lo vuelve a comprobar (regla 5).
 */
export function puedeUsarAsistente(rol: Rol): boolean {
  return rol === "admin";
}
