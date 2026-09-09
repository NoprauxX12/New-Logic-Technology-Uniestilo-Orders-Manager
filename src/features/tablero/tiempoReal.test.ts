import { describe, expect, it, vi } from "vitest";

import { suscribirAvancesTablero } from "@/features/tablero/tiempoReal";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("suscribirAvancesTablero", () => {
  it("escucha INSERT en avance_seccion y cierra el canal al desuscribir", () => {
    const canal = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    const supabase = {
      channel: vi.fn().mockReturnValue(canal),
      removeChannel: vi.fn(),
    };
    const alCambiar = vi.fn();

    const desuscribir = suscribirAvancesTablero(
      supabase as unknown as SupabaseClient<Database>,
      alCambiar,
    );

    expect(supabase.channel).toHaveBeenCalledWith("tablero-avances");
    expect(canal.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "avance_seccion",
      },
      alCambiar,
    );
    expect(canal.subscribe).toHaveBeenCalledOnce();

    desuscribir();

    expect(supabase.removeChannel).toHaveBeenCalledWith(canal);
  });
});
