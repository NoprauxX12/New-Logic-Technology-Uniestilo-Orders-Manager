import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type ItemParaTela = Database["public"]["Tables"]["item_orden"]["Row"];

export type OrdenParaTela = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  items: ItemParaTela[];
};

export async function obtenerOrdenesParaTela(): Promise<OrdenParaTela[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `
      id,
      numero_orden_compra,
      fecha_entrega,
      cliente ( razon_social ),
      item_orden ( * ),
      avance_seccion ( checkpoint )
      `,
    )
    .order("fecha_entrega", { ascending: true });

  if (error) {
    console.error("[HU-05] No se pudieron consultar las órdenes", error);
    throw new Error(
      "No se pudieron consultar las órdenes para programar tela.",
    );
  }

  return data
    .filter((orden) => {
      const marcados = orden.avance_seccion.map((avance) => avance.checkpoint);

      return (
        marcados.includes("ficha_adjunta") &&
        !marcados.includes("tela_programada") &&
        !marcados.includes("corte_completado") &&
        !marcados.includes("cerrada")
      );
    })
    .map((orden) => ({
      id: orden.id,
      numeroOrdenCompra: orden.numero_orden_compra,
      razonSocial: orden.cliente?.razon_social ?? "Cliente sin nombre",
      fechaEntrega: orden.fecha_entrega,
      items: orden.item_orden,
    }));
}
