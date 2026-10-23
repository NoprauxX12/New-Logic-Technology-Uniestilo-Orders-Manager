import "server-only";

import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";
import { fichasDeOrdenes } from "@/lib/storage/fichasDeOrdenes";
import type { FichaVisible } from "@/lib/storage/fichas";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type ItemParaTela = Database["public"]["Tables"]["item_orden"]["Row"];

export type OrdenParaTela = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  items: ItemParaTela[];
  /** La ficha técnica: es de donde sale cuánta tela lleva cada prenda. */
  fichas: FichaVisible[];
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
    .is(AVANCE_VIGENTE, null)
    .order("fecha_entrega", { ascending: true });

  if (error) {
    console.error("[HU-05] No se pudieron consultar las órdenes", error);
    throw new Error(
      "No se pudieron consultar las órdenes para programar tela.",
    );
  }

  const ordenes = data.filter((orden) => {
    const marcados = orden.avance_seccion.map((avance) => avance.checkpoint);

    return (
      marcados.includes("ficha_adjunta") &&
      !marcados.includes("tela_programada") &&
      !marcados.includes("corte_completado") &&
      !marcados.includes("cerrada")
    );
  });

  const fichas = await fichasDeOrdenes(
    supabase,
    ordenes.map((orden) => orden.id),
  );

  return ordenes.map((orden) => ({
    id: orden.id,
    numeroOrdenCompra: orden.numero_orden_compra,
    razonSocial: orden.cliente?.razon_social ?? "Cliente sin nombre",
    fechaEntrega: orden.fecha_entrega,
    items: orden.item_orden,
    fichas: fichas.get(orden.id) ?? [],
  }));
}
