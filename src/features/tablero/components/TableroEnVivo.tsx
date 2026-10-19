"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { suscribirAvancesTablero } from "@/features/tablero/tiempoReal";
import { createClient } from "@/lib/supabase/client";

/**
 * Escucha un avance nuevo, un lote a taller, una ficha técnica y una alerta
 * de tela, y pide al servidor los datos de nuevo (`router.refresh`), sin
 * recargar el navegador ni perder el scroll.
 */
export function TableroEnVivo({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    return suscribirAvancesTablero(supabase, () => {
      router.refresh();
    });
  }, [router]);

  return children;
}
