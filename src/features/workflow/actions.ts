"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { CheckpointId } from "@/features/workflow/checkpoints";
import { validarMarcacionCorte } from "@/features/workflow/reglas";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

export type ResultadoMarcacionCorte = {
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

/**
 * HU-08 · Marca la etapa de corte como completada.
 * Consulta los avances de la orden, aplica las reglas del workflow común
 * y guarda el checkpoint con el responsable del área de corte.
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

  // Quién está marcando. Mientras no exista el login (HU-16) sale del selector
  // del layout; después saldrá de la sesión, sin cambiar nada de aquí.
  const usuario = await getUsuarioActual();

  if (!usuario) {
    return {
      ok: false,
      mensaje: "Escoge arriba con qué persona estás trabajando.",
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
      mensaje: "No se pudo consultar el avance de la orden.",
    };
  }

  const checkpointsCompletados: CheckpointId[] = avances.map(
    (avance) => avance.checkpoint,
  );

  const resultado = validarMarcacionCorte({
    ordenExiste: orden !== null,
    checkpointsCompletados,
    rol: usuario.rol,
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
      checkpoint: "corte_completado",
      usuario_id: usuario.id,
    });

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
