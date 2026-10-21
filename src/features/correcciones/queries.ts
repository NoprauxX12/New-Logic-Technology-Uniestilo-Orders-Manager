import "server-only";

import type { PrendaOriginal } from "@/features/correcciones/reglas";
import type { CheckpointId } from "@/features/workflow/checkpoints";
import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-18 · Lo que hace falta saber de una orden para crear su orden de
 * corrección: sus prendas, qué lleva vigente y qué correcciones tiene ya.
 */

export type PrendaDeLaOriginal = PrendaOriginal & {
  tallas: string;
};

export type OrdenParaCorreccion = {
  id: string;
  numeroOrdenCompra: string;
  /** Los avances vigentes (los anulados por una devolución no cuentan). */
  marcados: CheckpointId[];
  prendas: PrendaDeLaOriginal[];
  /** Cuántas correcciones tiene ya esta orden. */
  correccionesCreadas: number;
  /** Los números que ya existen con el prefijo `<número>-C…`, para no chocar. */
  numerosOcupados: string[];
};

/** La orden con lo necesario para corregirla, o `null` si no existe. */
export async function obtenerOrdenParaCorreccion(
  ordenId: string,
): Promise<OrdenParaCorreccion | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       numero_orden_compra,
       item_orden ( id, descripcion, cantidad, tallas ),
       avance_seccion ( checkpoint )`,
    )
    .eq("id", ordenId)
    .is(AVANCE_VIGENTE, null)
    .maybeSingle();

  if (error) {
    console.error("[HU-18] No se pudo leer la orden", error);
    throw new Error("No se pudo leer la orden.");
  }

  if (!data) return null;

  const [correcciones, ocupados] = await Promise.all([
    supabase
      .from("orden")
      .select("id", { count: "exact", head: true })
      .eq("orden_original_id", ordenId),
    supabase
      .from("orden")
      .select("numero_orden_compra")
      .ilike("numero_orden_compra", `${data.numero_orden_compra}-C%`),
  ]);

  if (correcciones.error || ocupados.error) {
    console.error(
      "[HU-18] No se pudieron leer las correcciones",
      correcciones.error ?? ocupados.error,
    );
    throw new Error("No se pudieron leer las correcciones.");
  }

  return {
    id: data.id,
    numeroOrdenCompra: data.numero_orden_compra,
    marcados: data.avance_seccion.map((avance) => avance.checkpoint),
    prendas: data.item_orden.map((prenda) => ({
      id: prenda.id,
      descripcion: prenda.descripcion,
      cantidad: prenda.cantidad,
      tallas: prenda.tallas,
    })),
    correccionesCreadas: correcciones.count ?? 0,
    numerosOcupados: ocupados.data.map((o) => o.numero_orden_compra),
  };
}
