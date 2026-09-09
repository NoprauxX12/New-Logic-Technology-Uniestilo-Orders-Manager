import "server-only";

import type { CheckpointId } from "@/features/workflow/checkpoints";
import { validarLlegadaMarcacion } from "@/features/workflow/reglasMarcacion";
import { createClient } from "@/lib/supabase/server";

export type OrdenParaMarcacion = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  llegadaRegistrada: boolean;
  puedeMarcar: boolean;
  motivoNoDisponible: string | null;
};

export async function obtenerOrdenesParaMarcacion(): Promise<
  OrdenParaMarcacion[]
> {
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
    { data: recepciones, error: errorRecepciones },
  ] = await Promise.all([
    supabase.from("cliente").select("id, razon_social").in("id", clienteIds),
    supabase
      .from("avance_seccion")
      .select("orden_id, checkpoint")
      .in("orden_id", ordenIds),
    supabase
      .from("lote_taller")
      .select("orden_id, fecha_recepcion, recibido_por")
      .in("orden_id", ordenIds),
  ]);

  if (errorClientes || errorAvances || errorRecepciones) {
    console.error("No se pudo preparar la lista de marcación", {
      errorClientes,
      errorAvances,
      errorRecepciones,
    });

    throw new Error("No se pudo preparar la lista de marcación.");
  }

  const razonSocialPorCliente = new Map(
    clientes.map((cliente) => [cliente.id, cliente.razon_social]),
  );

  return ordenes.map((orden) => {
    const checkpointsCompletados = avances
      .filter((avance) => avance.orden_id === orden.id)
      .map((avance) => avance.checkpoint) as CheckpointId[];

    const recepcionConfirmada = recepciones.some(
      (recepcion) =>
        recepcion.orden_id === orden.id &&
        recepcion.fecha_recepcion !== null &&
        recepcion.recibido_por !== null,
    );

    const llegadaRegistrada =
      checkpointsCompletados.includes("llegada_marcacion");

    const resultado = validarLlegadaMarcacion({
      ordenExiste: true,
      recepcionConfirmada,
      checkpointsCompletados,
    });

    return {
      id: orden.id,
      numeroOrdenCompra: orden.numero_orden_compra,
      razonSocial:
        razonSocialPorCliente.get(orden.cliente_id) ?? "Cliente no disponible",
      fechaEntrega: orden.fecha_entrega,
      llegadaRegistrada,
      puedeMarcar: resultado.permitido,
      motivoNoDisponible: resultado.permitido ? null : resultado.mensaje,
    };
  });
}
