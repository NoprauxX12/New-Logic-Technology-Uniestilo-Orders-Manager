import "server-only";

import type { CheckpointId } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas de `avance_seccion`.
 *
 * La action las usa para preguntarle al motor con datos frescos de la base y no
 * con lo que venga del navegador: una Server Action se puede invocar con un
 * POST directo, así que lo que la pantalla creía marcado no sirve de base para
 * decidir.
 */

/** Los checkpoints que la orden ya tiene marcados, sin orden garantizado. */
export async function obtenerCheckpointsMarcados(
  ordenId: string,
): Promise<CheckpointId[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("avance_seccion")
    .select("checkpoint")
    .eq("orden_id", ordenId);

  if (error) {
    console.error("[HU-19] No se pudieron leer los avances de la orden", error);
    throw new Error("No se pudieron leer los avances de la orden.");
  }

  return data.map((fila) => fila.checkpoint);
}
