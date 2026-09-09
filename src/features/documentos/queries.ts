import "server-only";

import type { CheckpointId } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-13 · Lecturas de la pantalla de cierre.
 *
 * La lista muestra las órdenes que ya están listas para despachar y todavía no
 * se han completado. Cuando una se cierra, desaparece de aquí: es el criterio
 * de aceptación de que sale del listado de órdenes en curso, y sale solo,
 * porque el estado se deriva de los avances y no de una columna.
 */

export type OrdenParaCierre = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  numeroFactura: string | null;
  /** Todo lo que la orden lleva marcado, para que las reglas decidan. */
  marcados: CheckpointId[];
};

export type UsuarioDeSecretaria = {
  id: string;
  nombre: string;
};

export async function listarOrdenesParaCierre(): Promise<OrdenParaCierre[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       numero_orden_compra,
       fecha_entrega,
       numero_factura,
       cliente ( razon_social ),
       avance_seccion ( checkpoint )`,
    )
    .order("fecha_entrega", { ascending: true });

  if (error) {
    console.error("[HU-13] No se pudieron leer las órdenes", error);
    throw new Error("No se pudieron leer las órdenes.");
  }

  return data
    .map((orden) => ({
      id: orden.id,
      numeroOrdenCompra: orden.numero_orden_compra,
      razonSocial: orden.cliente?.razon_social ?? "Cliente sin nombre",
      fechaEntrega: orden.fecha_entrega,
      numeroFactura: orden.numero_factura,
      marcados: orden.avance_seccion.map((avance) => avance.checkpoint),
    }))
    .filter(
      (orden) =>
        orden.marcados.includes("lista_despacho") &&
        !orden.marcados.includes("cerrada"),
    );
}

/** Los avances de una orden, para que la action valide antes de escribir. */
export async function obtenerMarcadosDeLaOrden(
  ordenId: string,
): Promise<CheckpointId[] | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(`id, avance_seccion ( checkpoint )`)
    .eq("id", ordenId)
    .maybeSingle();

  if (error) {
    console.error("[HU-13] No se pudo leer la orden", error);
    return null;
  }

  if (!data) return null;

  return data.avance_seccion.map((avance) => avance.checkpoint);
}

/**
 * Quién puede cerrar. Mientras no exista el login (HU-16), la pantalla ofrece
 * esta lista y quien reporta se escoge a mano; después saldrá de la sesión.
 */
export async function obtenerUsuariosDeSecretaria(): Promise<
  UsuarioDeSecretaria[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre")
    .eq("rol", "secretaria")
    .order("nombre");

  if (error) {
    console.error("[HU-13] No se pudo leer el personal de secretaría", error);
    return [];
  }

  return data;
}
