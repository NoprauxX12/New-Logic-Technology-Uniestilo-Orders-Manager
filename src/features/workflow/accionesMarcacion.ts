"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { CheckpointId } from "@/features/workflow/checkpoints";
import { validarLlegadaMarcacion } from "@/features/workflow/reglasMarcacion";
import { createClient } from "@/lib/supabase/server";

export type ResultadoLlegadaMarcacion = {
  ok: boolean;
  mensaje: string;
};

const ordenIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "La identificación de la orden no es válida.",
  );

const VIOLACION_DE_UNICIDAD = "23505";
const USUARIO_MARCACION_ID = "00000000-0000-0000-0000-0000000000a6";

export async function marcarLlegadaMarcacion(
  ordenId: string,
): Promise<ResultadoLlegadaMarcacion> {
  const validacionId = ordenIdSchema.safeParse(ordenId);

  if (!validacionId.success) {
    return {
      ok: false,
      mensaje: "La orden seleccionada no es válida.",
    };
  }

  const supabase = await createClient();

  const { data: orden, error: errorOrden } = await supabase
    .from("orden")
    .select("id")
    .eq("id", validacionId.data)
    .maybeSingle();

  if (errorOrden) {
    console.error("No se pudo consultar la orden", errorOrden);

    return {
      ok: false,
      mensaje: "No se pudo consultar la orden. Vuelve a intentarlo.",
    };
  }

  const { data: avances, error: errorAvances } = await supabase
    .from("avance_seccion")
    .select("checkpoint")
    .eq("orden_id", validacionId.data);

  if (errorAvances) {
    console.error("No se pudieron consultar los avances", errorAvances);

    return {
      ok: false,
      mensaje: "No se pudieron consultar los avances de la orden.",
    };
  }

  const { data: recepciones, error: errorRecepciones } = await supabase
    .from("lote_taller")
    .select("id")
    .eq("orden_id", validacionId.data)
    .not("fecha_recepcion", "is", null)
    .not("recibido_por", "is", null)
    .limit(1);

  if (errorRecepciones) {
    console.error(
      "No se pudo comprobar la recepción de las prendas",
      errorRecepciones,
    );

    return {
      ok: false,
      mensaje: "No se pudo comprobar la recepción de las prendas.",
    };
  }

  const checkpointsCompletados: CheckpointId[] = avances.map(
    (avance) => avance.checkpoint,
  );

  const resultado = validarLlegadaMarcacion({
    ordenExiste: orden !== null,
    recepcionConfirmada: recepciones.length > 0,
    checkpointsCompletados,
  });

  if (!resultado.permitido) {
    return {
      ok: false,
      mensaje: resultado.mensaje,
    };
  }

  const { error: errorMarcacion } = await supabase
    .from("avance_seccion")
    .insert({
      orden_id: validacionId.data,
      checkpoint: "llegada_marcacion",
      usuario_id: USUARIO_MARCACION_ID,
    });

  if (errorMarcacion) {
    if (errorMarcacion.code === VIOLACION_DE_UNICIDAD) {
      return {
        ok: false,
        mensaje: "La llegada a marcación ya fue registrada.",
      };
    }

    console.error("No se pudo registrar la llegada", errorMarcacion);

    return {
      ok: false,
      mensaje: "No se pudo registrar la llegada. Vuelve a intentarlo.",
    };
  }

  revalidatePath("/ordenes/marcacion");
  revalidatePath("/tablero");
  revalidatePath(`/tablero/${validacionId.data}`);

  return {
    ok: true,
    mensaje: "La orden fue marcada como recibida en marcación.",
  };
}
