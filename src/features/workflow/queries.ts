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
  marcados: CheckpointId[];
  /** HU-11: si algún lote ya volvió del taller con su recepción confirmada. */
  recepcionConfirmada: boolean;
};

/** La situación de la orden, o `null` si la orden no existe. */
export async function obtenerSituacionDeOrden(
  ordenId: string,
): Promise<SituacionDeOrden | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       avance_seccion ( checkpoint ),
       lote_taller ( recibido_completo )`,
    )
    .eq("id", ordenId)
    .maybeSingle();

  if (error) {
    console.error("[workflow] No se pudo leer la orden", error);
    throw new Error("No se pudo leer la orden.");
  }

  if (!data) return null;

  return {
    marcados: data.avance_seccion.map((avance) => avance.checkpoint),
    recepcionConfirmada: data.lote_taller.some(
      (lote) => lote.recibido_completo !== null,
    ),
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

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       numero_orden_compra,
       fecha_entrega,
       cliente ( razon_social ),
       avance_seccion ( checkpoint, fecha_hora ),
       lote_taller ( recibido_completo )`,
    )
    .order("fecha_entrega", { ascending: true });

  if (error) {
    const { hu } = buscarCheckpoint(checkpoint);
    console.error(`[${hu}] No se pudieron consultar las órdenes`, error);
    throw new Error("No se pudieron consultar las órdenes.");
  }

  return data.map((orden) => {
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
        recepcionConfirmada: orden.lote_taller.some(
          (lote) => lote.recibido_completo !== null,
        ),
      }),
    };
  });
}
