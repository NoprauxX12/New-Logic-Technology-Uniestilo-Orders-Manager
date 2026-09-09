import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

const FILTRO_AVANCE = {
  event: "INSERT" as const,
  schema: "public" as const,
  table: "avance_seccion" as const,
};

/**
 * Se suscribe a un avance nuevo. Devuelve la función para cerrar el canal.
 * El tablero no muta aquí: solo avisa para que se vuelvan a leer las órdenes.
 */
export function suscribirAvancesTablero(
  supabase: SupabaseClient<Database>,
  alCambiar: () => void,
): () => void {
  const canal: RealtimeChannel = supabase
    .channel("tablero-avances")
    .on("postgres_changes", FILTRO_AVANCE, alCambiar)
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
