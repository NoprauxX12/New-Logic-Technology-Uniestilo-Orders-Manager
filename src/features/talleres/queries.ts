import "server-only";

import type { CheckpointId } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-10 · Lecturas de la pantalla de despacho a taller.
 *
 * Las usa el Server Component de la orden y la propia action, que antes de
 * escribir necesita saber qué checkpoints lleva marcados la orden.
 */

export type PrendaDeLaOrden = {
  id: string;
  descripcion: string;
  cantidad: number;
  tallas: string;
};

/** Un lote ya despachado. De aquí sale el taller que se ve en la orden. */
export type LoteDespachado = {
  id: string;
  taller: string;
  descripcionPrendas: string;
  fechaEnvio: string;
  enviadoPor: string | null;
  /** HU-11 completa la fila cuando el lote vuelve. */
  recibido: boolean;
  observacionesRecepcion: string | null;
};

export type OrdenParaDespacho = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaIngreso: string;
  fechaEntrega: string;
  prendas: PrendaDeLaOrden[];
  /** Checkpoints ya marcados: el estado de la orden se deriva de aquí. */
  marcados: CheckpointId[];
  /** Del más reciente al más antiguo. */
  lotes: LoteDespachado[];
};

export type UsuarioDeLogistica = {
  id: string;
  nombre: string;
};

export async function obtenerOrdenParaDespacho(
  ordenId: string,
): Promise<OrdenParaDespacho | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       numero_orden_compra,
       fecha_ingreso,
       fecha_entrega,
       cliente ( razon_social ),
       item_orden ( id, descripcion, cantidad, tallas ),
       avance_seccion ( checkpoint ),
       lote_taller (
         id,
         taller,
         descripcion_prendas,
         fecha_envio,
         recibido_completo,
         observaciones_recepcion,
         remitente:usuario!lote_taller_enviado_por_fkey ( nombre )
       )`,
    )
    .eq("id", ordenId)
    .maybeSingle();

  if (error) {
    console.error("[HU-10] No se pudo leer la orden", error);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    numeroOrdenCompra: data.numero_orden_compra,
    razonSocial: data.cliente?.razon_social ?? "Cliente sin nombre",
    fechaIngreso: data.fecha_ingreso,
    fechaEntrega: data.fecha_entrega,
    prendas: data.item_orden.map((prenda) => ({
      id: prenda.id,
      descripcion: prenda.descripcion,
      cantidad: prenda.cantidad,
      tallas: prenda.tallas,
    })),
    marcados: data.avance_seccion.map((avance) => avance.checkpoint),
    lotes: data.lote_taller
      .map((lote) => ({
        id: lote.id,
        taller: lote.taller,
        descripcionPrendas: lote.descripcion_prendas,
        fechaEnvio: lote.fecha_envio,
        enviadoPor: lote.remitente?.nombre ?? null,
        // Un lote está recibido cuando HU-11 llenó su recepción; la columna
        // dice además si llegó completo, que es otra cosa.
        recibido: lote.recibido_completo !== null,
        observacionesRecepcion: lote.observaciones_recepcion,
      }))
      .sort((uno, otro) => otro.fechaEnvio.localeCompare(uno.fechaEnvio)),
  };
}

/**
 * Quién puede despachar. Mientras no exista el login (HU-16), el formulario
 * ofrece esta lista y quien despacha se escoge a mano; después saldrá de la
 * sesión y esta consulta desaparece.
 */
export async function obtenerUsuariosDeLogistica(): Promise<
  UsuarioDeLogistica[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("usuario")
    .select("id, nombre")
    .eq("rol", "logistica")
    .order("nombre");

  if (error) {
    console.error("[HU-10] No se pudo leer el personal de logística", error);
    return [];
  }

  return data;
}
