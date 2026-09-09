"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { usuarioActual } from "@/features/auth/usuarioActual";
import {
  buscarCheckpoint,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";
import { obtenerCheckpointsMarcados } from "@/features/workflow/queries";
import { validarMarcacionCorte } from "@/features/workflow/reglas";
import { marcarAvanceSchema } from "@/features/workflow/schemas";
import { puedeMarcar } from "@/features/workflow/transiciones";
import { createClient } from "@/lib/supabase/server";

/**
 * Marcar un avance de una orden.
 *
 * Única vía para escribir en `avance_seccion` (regla 2): antes de insertar le
 * pregunta al motor si ese checkpoint es el siguiente de la secuencia y si el
 * rol de quien marca es el dueño de esa sección.
 *
 * `marcarAvance` es genérica y sirve para las cinco historias de marcado; lo
 * único que cambia entre ellas es el checkpoint que se le pasa.
 * `marcarCorteCompletado` es la versión propia de HU-08, que llegó por otra
 * rama: hace lo mismo para `corte_completado` y está pendiente de migrarse a la
 * genérica (ver el issue de refactor). Hasta entonces conviven.
 *
 * Nota de seguridad: una Server Action se puede invocar con un POST directo,
 * sin pasar por el botón, así que ni el usuario ni los avances de la orden se
 * toman de lo que llega en el formulario. Hoy las políticas RLS de
 * `avance_seccion` dejan insertar a cualquiera ("temporal HU-17"), de modo que
 * la llamada al motor es la única barrera real de secuencia y de rol; HU-17 la
 * duplica en la base.
 */

/** Lo que la action le devuelve al botón. */
export type EstadoMarcado = {
  ok: boolean;
  mensaje: string;
};

/** HU-08 devuelve la misma forma; se mantiene el nombre por sus llamadas. */
export type ResultadoMarcacionCorte = EstadoMarcado;

/** Código de Postgres para "violación de restricción única". */
const VIOLACION_DE_UNICIDAD = "23505";

export async function marcarAvance(
  _estadoPrevio: EstadoMarcado,
  formData: FormData,
): Promise<EstadoMarcado> {
  const validacion = marcarAvanceSchema.safeParse({
    ordenId: formData.get("ordenId"),
    checkpoint: formData.get("checkpoint"),
  });

  if (!validacion.success) {
    console.error(
      "[HU-19] Entrada inválida al marcar un avance",
      validacion.error.issues,
    );
    return {
      ok: false,
      mensaje:
        "No se pudo identificar la orden. Vuelve a abrirla desde el tablero.",
    };
  }

  const { ordenId, checkpoint } = validacion.data;
  const usuario = await usuarioActual();
  const marcados = await obtenerCheckpointsMarcados(ordenId);

  const veredicto = puedeMarcar({ checkpoint, marcados, rol: usuario.rol });
  if (!veredicto.permitido) {
    return { ok: false, mensaje: veredicto.mensaje };
  }

  const supabase = await createClient();

  // `fecha_hora` no se manda: la pone el `default now()` de la columna. Una hora
  // que viniera del navegador sería falsificable, y la bitácora tiene que ser
  // confiable (RNF-05).
  const { error } = await supabase.from("avance_seccion").insert({
    orden_id: ordenId,
    checkpoint,
    usuario_id: usuario.id,
  });

  if (error && error.code !== VIOLACION_DE_UNICIDAD) {
    console.error("[HU-19] No se pudo marcar el avance", error);
    return { ok: false, mensaje: "No se pudo marcar. Vuelve a intentarlo." };
  }

  // También se revalida cuando el insert chocó con el índice único: en ese caso
  // la base sí cambió —lo marcó otra persona— y la pantalla está mintiendo.
  revalidatePath(`/tablero/${ordenId}`);
  revalidatePath("/tablero");

  const { etiqueta } = buscarCheckpoint(checkpoint);

  if (error) {
    return {
      ok: false,
      mensaje: `"${etiqueta}" ya lo había marcado otra persona.`,
    };
  }

  const sigue = loQueSigue([...marcados, checkpoint]);

  return {
    ok: true,
    mensaje: sigue
      ? `Listo: ${etiqueta}. Ahora le toca a ${sigue.responsable}.`
      : `Listo: ${etiqueta}. La orden terminó su recorrido.`,
  };
}

const ordenIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "La identificación de la orden no es válida.",
  );

const USUARIO_CORTE_ID = "00000000-0000-0000-0000-0000000000a4";

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
      usuario_id: USUARIO_CORTE_ID,
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
  revalidatePath(`/tablero/${validacionId.data}`);

  return {
    ok: true,
    mensaje: "La etapa de corte fue marcada como completada.",
  };
}
