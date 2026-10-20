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

const FILTRO_FICHA = {
  event: "INSERT" as const,
  schema: "public" as const,
  table: "ficha_tecnica" as const,
};

// HU-07: un aviso de tela entra al tablero y sale cuando se marca resuelto.
const FILTRO_ALERTA = {
  event: "*" as const,
  schema: "public" as const,
  table: "alerta" as const,
};

/**
 * Se suscribe a un avance nuevo, a los cambios en los lotes a taller, a una
 * ficha técnica nueva y a las alertas de tela. Devuelve la función para cerrar
 * el canal. El tablero no muta aquí: solo avisa para que se vuelvan a leer
 * las órdenes.
 */
export function suscribirAvancesTablero(
  supabase: SupabaseClient<Database>,
  alCambiar: () => void,
): () => void {
  const canal: RealtimeChannel = supabase
    .channel("tablero-avances")
    .on("postgres_changes", FILTRO_AVANCE, alCambiar)
    .on("postgres_changes", FILTRO_LOTES, alCambiar)
    .on("postgres_changes", FILTRO_FICHA, alCambiar)
    .on("postgres_changes", FILTRO_ALERTA, alCambiar)
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}
