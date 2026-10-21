import "server-only";

import {
  buscarCheckpoint,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";
import {
  puedeMarcar,
  type ResultadoMarcado,
} from "@/features/workflow/transiciones";
import { firmarFichas } from "@/lib/storage/firmarFichas";
import type { FichaVisible } from "@/lib/storage/fichas";
import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas del avance de las órdenes.
 *
 * `obtenerSituacionDeOrden` es lo que la action lee antes de escribir: le
 * pregunta al motor con datos frescos de la base y no con lo que venga del
 * navegador, porque una Server Action se puede invocar con un POST directo.
 *
 * `obtenerOrdenesParaSeccion` alimenta la pantalla con la que una sección marca
 * su etapa: la misma consulta sirve para corte (HU-08), marcación (HU-12) y la
 * que venga después; solo cambia el checkpoint.
 */

/** Lo que el motor necesita saber de una orden para decidir. */
export type SituacionDeOrden = {
  /** Los avances vigentes: los que una devolución anuló (HU-18) no cuentan. */
  marcados: CheckpointId[];
  /** HU-18: por qué etapa entró al flujo una orden de corrección. */
  etapaInicial: CheckpointId | null;
  /** HU-11: si algún lote ya volvió del taller con su recepción confirmada. */
  recepcionConfirmada: boolean;
  /** HU-22: si la orden tiene una alerta de tela cuya tela no ha llegado. */
  esperandoTela: boolean;
};

/** La situación de la orden, o `null` si la orden no existe. */
export async function obtenerSituacionDeOrden(
  ordenId: string,
): Promise<SituacionDeOrden | null> {
  const supabase = await createClient();

  // `alerta` no se lee directo: corte no tiene permiso para verla, y la
  // consulta devolvería cero filas sin dar error. La función de la base solo
  // responde sí o no, y sí puede mirar (ver la migración de HU-22).
  const [{ data, error }, { data: esperandoTela, error: errorTela }] =
    await Promise.all([
      supabase
        .from("orden")
        .select(
          `id,
           etapa_inicial,
           avance_seccion ( checkpoint ),
           lote_taller ( recibido_completo )`,
        )
        .eq("id", ordenId)
        .is(AVANCE_VIGENTE, null)
        .maybeSingle(),
      supabase.rpc("orden_espera_tela", { p_orden_id: ordenId }),
    ]);

  if (error || errorTela) {
    console.error("[workflow] No se pudo leer la orden", error ?? errorTela);
    throw new Error("No se pudo leer la orden.");
  }

  if (!data) return null;

  return {
    marcados: data.avance_seccion.map((avance) => avance.checkpoint),
    etapaInicial: data.etapa_inicial,
    recepcionConfirmada: data.lote_taller.some(
      (lote) => lote.recibido_completo !== null,
    ),
    esperandoTela: esperandoTela === true,
  };
}

export type OrdenParaSeccion = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaEntrega: string;
  /** Si esta sección ya marcó su etapa en la orden. */
  yaMarcada: boolean;
  fechaMarcado: string | null;
  /** Lo que el motor dice de marcar esta etapa, para quien está mirando. */
  veredicto: ResultadoMarcado;
  /** HU-04: el equipo ve la ficha desde cualquier sección. */
  fichas: FichaVisible[];
};

/**
 * Las órdenes como las ve una sección, con el veredicto del motor para cada
 * una según el rol de quien mira. La action lo vuelve a calcular antes de
 * escribir: esto solo decide qué se pinta.
 */
export async function obtenerOrdenesParaSeccion(
  checkpoint: CheckpointId,
  rol: Rol,
): Promise<OrdenParaSeccion[]> {
  const supabase = await createClient();

  const [{ data, error }, { data: esperando, error: errorTela }] =
    await Promise.all([
      supabase
        .from("orden")
        .select(
          `id,
           numero_orden_compra,
           fecha_entrega,
           etapa_inicial,
           cliente ( razon_social ),
           avance_seccion ( checkpoint, fecha_hora ),
           lote_taller ( recibido_completo ),
           ficha_tecnica (
             id,
             archivo_ruta,
             fecha_subida,
             usuario:subida_por ( nombre )
           )`,
        )
        .is(AVANCE_VIGENTE, null)
        .order("fecha_entrega", { ascending: true }),
      // Una sola llamada para toda la lista, no una por tarjeta (HU-22).
      supabase.rpc("ordenes_esperando_tela"),
    ]);

  if (error || errorTela) {
    const { hu } = buscarCheckpoint(checkpoint);
    console.error(
      `[${hu}] No se pudieron consultar las órdenes`,
      error ?? errorTela,
    );
    throw new Error("No se pudieron consultar las órdenes.");
  }

  const esperandoTela = new Set(esperando ?? []);

  return Promise.all(
    data.map(async (orden) => {
      const marcados = orden.avance_seccion.map((avance) => avance.checkpoint);
      const propio = orden.avance_seccion.find(
        (avance) => avance.checkpoint === checkpoint,
      );

      return {
        id: orden.id,
        numeroOrdenCompra: orden.numero_orden_compra,
        razonSocial: orden.cliente?.razon_social ?? "Cliente sin nombre",
        fechaEntrega: orden.fecha_entrega,
        yaMarcada: propio !== undefined,
        fechaMarcado: propio?.fecha_hora ?? null,
        veredicto: puedeMarcar({
          checkpoint,
          marcados,
          rol,
          etapaInicial: orden.etapa_inicial,
          recepcionConfirmada: orden.lote_taller.some(
            (lote) => lote.recibido_completo !== null,
          ),
          esperandoTela: esperandoTela.has(orden.id),
        }),
        fichas: await firmarFichas(supabase, orden.ficha_tecnica),
      };
    }),
  );
}
