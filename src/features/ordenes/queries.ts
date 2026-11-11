import "server-only";

import type { EntradaFormularioOrden } from "@/features/ordenes/formulario";
import { entradaDesdeOrden } from "@/features/ordenes/edicion";
import type { CheckpointId } from "@/features/workflow/checkpoints";
import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";
import { createClient } from "@/lib/supabase/server";

/** Lo que hace falta para decidir si la orden se edita y llenar el formulario. */
export type OrdenParaEditar = {
  id: string;
  numeroOrdenCompra: string;
  /** Los avances vigentes (los anulados por una devolución no cuentan). */
  marcados: CheckpointId[];
  etapaInicial: CheckpointId | null;
  entrada: EntradaFormularioOrden;
  /** Cuántas órdenes más tiene el cliente: sus datos no se cambian si hay otras. */
  otrasOrdenesDelCliente: number;
};

/** La orden lista para editarse, o `null` si no existe. */
export async function obtenerOrdenParaEditar(
  ordenId: string,
): Promise<OrdenParaEditar | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       numero_orden_compra,
       fecha_ingreso,
       fecha_entrega,
       observaciones,
       etapa_inicial,
       cliente_id,
       cliente ( nit, razon_social, contacto_nombre, contacto_celular ),
       item_orden ( id, descripcion, cantidad, tallas, tallaje, valor, observaciones, creado_en ),
       avance_seccion ( checkpoint )`,
    )
    .eq("id", ordenId)
    .is(AVANCE_VIGENTE, null)
    .maybeSingle();

  if (error) {
    console.error("[Edición] No se pudo leer la orden", error);
    throw new Error("No se pudo leer la orden.");
  }

  if (!data) return null;

  const { count, error: errorOtras } = await supabase
    .from("orden")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", data.cliente_id)
    .neq("id", ordenId);

  if (errorOtras) {
    console.error("[Edición] No se pudo leer el cliente", errorOtras);
    throw new Error("No se pudo leer el cliente de la orden.");
  }

  // Del más viejo al más nuevo, para que las prendas salgan como se registraron.
  const prendas = [...data.item_orden].sort((a, b) =>
    a.creado_en.localeCompare(b.creado_en),
  );

  return {
    id: data.id,
    numeroOrdenCompra: data.numero_orden_compra,
    marcados: data.avance_seccion.map((avance) => avance.checkpoint),
    etapaInicial: data.etapa_inicial,
    otrasOrdenesDelCliente: count ?? 0,
    entrada: entradaDesdeOrden({
      numeroOrdenCompra: data.numero_orden_compra,
      fechaIngreso: data.fecha_ingreso,
      fechaEntrega: data.fecha_entrega,
      observaciones: data.observaciones,
      nit: data.cliente?.nit ?? "",
      razonSocial: data.cliente?.razon_social ?? "",
      contactoNombre: data.cliente?.contacto_nombre ?? "",
      contactoCelular: data.cliente?.contacto_celular ?? "",
      prendas,
    }),
  };
}
