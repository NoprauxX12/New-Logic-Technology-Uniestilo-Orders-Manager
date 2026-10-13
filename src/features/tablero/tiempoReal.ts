import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

const FILTRO_AVANCE = {
  event: "INSERT" as const,
  schema: "public" as const,
  table: "avance_seccion" as const,
};

// HU-10 y HU-11: un lote se crea al despachar y se completa al recibir, y las
// dos cosas cambian el estado que el tablero muestra.
const FILTRO_LOTES = {
  event: "*" as const,
  schema: "public" as const,
  table: "lote_taller" as const,
};

/**
 * Se suscribe a un avance nuevo y a los cambios en los lotes a taller. Devuelve
 * la función para cerrar el canal. El tablero no muta aquí: solo avisa para que
 * se vuelvan a leer las órdenes.
 */
export function suscribirAvancesTablero(
  supabase: SupabaseClient<Database>,
  alCambiar: () => void,
): () => void {
  const canal: RealtimeChannel = supabase
    .channel("tablero-avances")
    .on("postgres_changes", FILTRO_AVANCE, alCambiar)
    .on("postgres_changes", FILTRO_LOTES, alCambiar)
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
