import "server-only";

import { createClient } from "@/lib/supabase/server";

export type OrdenParaCorte = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  corteCompletado: boolean;
  fechaCorte: string | null;
};

/**
 * HU-08 · Obtiene las órdenes que verá el área de corte.
 */
export async function obtenerOrdenesParaCorte(): Promise<OrdenParaCorte[]> {
  const supabase = await createClient();

  const { data: ordenes, error: errorOrdenes } = await supabase
    .from("orden")
    .select("id, numero_orden_compra, cliente_id, fecha_entrega")
    .order("fecha_entrega", { ascending: true });

  if (errorOrdenes) {
    console.error("No se pudieron consultar las órdenes", errorOrdenes);
    throw new Error("No se pudieron consultar las órdenes.");
  }

  if (ordenes.length === 0) {
    return [];
  }

  const ordenIds = ordenes.map((orden) => orden.id);
  const clienteIds = [...new Set(ordenes.map((orden) => orden.cliente_id))];

  const [
    { data: clientes, error: errorClientes },
    { data: avances, error: errorAvances },
  ] = await Promise.all([
    supabase.from("cliente").select("id, razon_social").in("id", clienteIds),
    supabase
      .from("avance_seccion")
      .select("orden_id, fecha_hora")
      .in("orden_id", ordenIds)
      .eq("checkpoint", "corte_completado"),
  ]);

  if (errorClientes) {
    console.error(
      "[HU-08] No se pudieron consultar los clientes",
      errorClientes,
    );
    throw new Error("No se pudieron consultar los clientes.");
  }

  if (errorAvances) {
    console.error("No se pudieron consultar los avances", errorAvances);
    throw new Error("No se pudieron consultar los avances.");
  }

  const razonSocialPorCliente = new Map(
    clientes.map((cliente) => [cliente.id, cliente.razon_social]),
  );

  const fechaCortePorOrden = new Map(
    avances.map((avance) => [avance.orden_id, avance.fecha_hora]),
  );

  return ordenes.map((orden) => {
    const fechaCorte = fechaCortePorOrden.get(orden.id) ?? null;

    return {
      id: orden.id,
      numeroOrdenCompra: orden.numero_orden_compra,
      razonSocial:
        razonSocialPorCliente.get(orden.cliente_id) ?? "Cliente no disponible",
      fechaEntrega: orden.fecha_entrega,
      corteCompletado: fechaCorte !== null,
      fechaCorte,
    };
  });
}
