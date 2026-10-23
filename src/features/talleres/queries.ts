import "server-only";

import { CHECKPOINT_REQUERIDO } from "@/features/talleres/reglas";
import type { CheckpointId } from "@/features/workflow/checkpoints";
import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";
import { fichasDeOrdenes } from "@/lib/storage/fichasDeOrdenes";
import type { FichaVisible } from "@/lib/storage/fichas";
import { createClient } from "@/lib/supabase/server";
import { describirEstadoDeTalleres } from "@/lib/talleres/estadoLotes";

/**
 * HU-10 · Lecturas de la pantalla de despacho a taller.
 *
 * Las usa el Server Component de la orden y la propia action, que antes de
 * escribir necesita saber qué checkpoints lleva marcados la orden. Quién
 * despacha o recibe sale de la sesión, así que aquí no se lista a nadie.
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
  /** La ficha técnica: logística ve qué lleva lo que despacha y recibe. */
  fichas: FichaVisible[];
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
    .is(AVANCE_VIGENTE, null)
    .maybeSingle();

  if (error) {
    console.error("[HU-10] No se pudo leer la orden", error);
    return null;
  }

  if (!data) return null;

  const fichas = await fichasDeOrdenes(supabase, [data.id]);

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
    fichas: fichas.get(data.id) ?? [],
  };
}

export type OrdenParaTalleres = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  /** Derivado de los lotes (regla 1): "En confección", "Todo volvió"… */
  estadoTalleres: string;
  /** Cuántos lotes ha despachado la orden. Con 0, falta mandar el primero. */
  lotesTotales: number;
  /** Cuántos siguen en el taller sin confirmar su recepción. */
  lotesSinRecibir: number;
  /** Cuándo salió el lote más viejo que sigue afuera: de ahí salen los días. */
  enTallerDesde: string | null;
};

/**
 * Las órdenes con las que logística puede trabajar: las que ya están recogidas
 * y bordadas, o que ya tienen algún lote, y todavía no se cerraron. El lote
 * cuenta aparte para que un lote que salió antes de existir HU-09 se pueda
 * seguir recibiendo (HU-11). Desde aquí se entra al detalle de cada
 * una para despachar (HU-10) o recibir (HU-11).
 */
export async function listarOrdenesParaTalleres(): Promise<
  OrdenParaTalleres[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       numero_orden_compra,
       fecha_entrega,
       cliente ( razon_social ),
       avance_seccion ( checkpoint ),
       lote_taller ( recibido_completo, fecha_envio )`,
    )
    .is(AVANCE_VIGENTE, null)
    .order("fecha_entrega", { ascending: true });

  if (error) {
    console.error("[HU-10] No se pudieron leer las órdenes", error);
    throw new Error("No se pudieron leer las órdenes.");
  }

  return data
    .filter((orden) => {
      const marcados = orden.avance_seccion.map((avance) => avance.checkpoint);
      const listaParaTaller =
        marcados.includes(CHECKPOINT_REQUERIDO) || orden.lote_taller.length > 0;
      return listaParaTaller && !marcados.includes("cerrada");
    })
    .map((orden) => {
      const afuera = orden.lote_taller.filter(
        (lote) => lote.recibido_completo === null,
      );

      return {
        id: orden.id,
        numeroOrdenCompra: orden.numero_orden_compra,
        razonSocial: orden.cliente?.razon_social ?? "Cliente sin nombre",
        fechaEntrega: orden.fecha_entrega,
        estadoTalleres: describirEstadoDeTalleres(
          orden.lote_taller.map((lote) => ({
            recibido: lote.recibido_completo !== null,
          })),
        ),
        lotesTotales: orden.lote_taller.length,
        lotesSinRecibir: afuera.length,
        enTallerDesde: afuera.map((lote) => lote.fecha_envio).sort()[0] ?? null,
      };
    });
}
