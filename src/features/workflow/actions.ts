"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { CheckpointId } from "@/features/workflow/checkpoints";
import { validarMarcacionCorte } from "@/features/workflow/reglas";
import { createClient } from "@/lib/supabase/server";

export type ResultadoMarcacionCorte = {
  ok: boolean;
  mensaje: string;
};

const ordenIdSchema = z
  .string()
  .uuid("La identificación de la orden no es válida.");

const VIOLACION_DE_UNICIDAD = "23505";

/**
 * HU-08 · Marca la etapa de corte como completada.
 * Consulta la situación de la orden, aplica las reglas del workflow y delega
 * el registro definitivo en la función de PostgreSQL.
 */
export async function marcarCorteCompletado(
  ordenId: string,
): Promise<ResultadoMarcacionCorte> {
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
    .select("seccion")
    .eq("orden_id", validacionId.data)
    .eq("seccion", "corte_completado");

  if (errorAvances) {
    console.error("No se pudieron consultar los avances", errorAvances);

    return {
      ok: false,
      mensaje: "No se pudo consultar el avance de la orden.",
    };
  }

  const checkpointsCompletados: CheckpointId[] =
    avances.length > 0 ? ["corte_completado"] : [];

  const resultado = validarMarcacionCorte({
    ordenExiste: orden !== null,
    checkpointsCompletados,
  });

  if (!resultado.permitido) {
    return {
      ok: false,
      mensaje: resultado.mensaje,
    };
  }

  const { error: errorMarcacion } = await supabase.rpc(
    "marcar_corte_completado",
    {
      p_orden_id: validacionId.data,
    },
  );

  if (errorMarcacion) {
    if (errorMarcacion.code === VIOLACION_DE_UNICIDAD) {
      return {
        ok: false,
        mensaje: "La etapa de corte ya fue marcada como completada.",
      };
    }

    console.error("No se pudo completar corte", errorMarcacion);

    return {
      ok: false,
      mensaje: "No se pudo completar corte. Vuelve a intentarlo.",
    };
  }

  revalidatePath("/ordenes/corte");
  revalidatePath("/tablero");
  revalidatePath(`/ordenes/${validacionId.data}`);

  return {
    ok: true,
    mensaje: "La etapa de corte fue marcada como completada.",
  };
}
