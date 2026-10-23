import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { firmarFichas } from "@/lib/storage/firmarFichas";
import type { FichaVisible, FilaFicha } from "@/lib/storage/fichas";
import type { Database } from "@/types/database.types";

/**
 * Las fichas técnicas de un conjunto de órdenes, listas para abrir.
 *
 * Todos los roles ven la ficha de la orden con la que trabajan, para tener el
 * contexto de lo que se va a producir (HU-04): la lee cualquier cuenta con
 * sesión, tanto la fila de `ficha_tecnica` como el archivo del bucket. Esta
 * función es lo que cada pantalla llama para no repetir la consulta ni la firma
 * de las URL.
 *
 * Es una sola consulta para toda la lista, no una por orden. La más reciente va
 * primero: una orden puede recibir otra versión del archivo.
 */
export async function fichasDeOrdenes(
  supabase: SupabaseClient<Database>,
  ordenIds: readonly string[],
): Promise<Map<string, FichaVisible[]>> {
  const porOrden = new Map<string, FichaVisible[]>();
  if (ordenIds.length === 0) return porOrden;

  const { data, error } = await supabase
    .from("ficha_tecnica")
    .select(
      `id,
       orden_id,
       archivo_ruta,
       fecha_subida,
       usuario:subida_por ( nombre )`,
    )
    .in("orden_id", [...ordenIds])
    .order("fecha_subida", { ascending: false });

  if (error) {
    console.error("[HU-04] No se pudieron consultar las fichas", error);
    throw new Error("No se pudieron consultar las fichas técnicas.");
  }

  const filas: (FilaFicha & { orden_id: string })[] = data;
  const firmadas = await firmarFichas(supabase, filas);

  filas.forEach((fila, indice) => {
    const de = porOrden.get(fila.orden_id) ?? [];
    de.push(firmadas[indice]);
    porOrden.set(fila.orden_id, de);
  });

  return porOrden;
}
