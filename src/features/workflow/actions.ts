"use server";

import { revalidatePath } from "next/cache";

import { usuarioActual } from "@/features/auth/usuarioActual";
import { buscarCheckpoint } from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";
import { obtenerCheckpointsMarcados } from "@/features/workflow/queries";
import { marcarAvanceSchema } from "@/features/workflow/schemas";
import { puedeMarcar } from "@/features/workflow/transiciones";
import { createClient } from "@/lib/supabase/server";

/**
 * Marcar un avance de una orden.
 *
 * Única vía para escribir en `avance_seccion` (regla 2): antes de insertar le
 * pregunta al motor si ese checkpoint es el siguiente de la secuencia y si el
 * rol de quien marca es el dueño de esa sección. Sirve para las cinco historias
 * de marcado —HU-08, HU-11, HU-12, HU-13 y HU-19—: lo único que cambia entre
 * ellas es el checkpoint que se le pasa.
 *
 * Nota de seguridad: una Server Action se puede invocar con un POST directo,
 * sin pasar por el botón, así que ni el usuario ni los avances de la orden se
 * toman de lo que llega en el formulario. Hoy las políticas RLS de
 * `avance_seccion` dejan insertar a cualquiera ("temporal HU-17"), de modo que
 * la llamada a `puedeMarcar` de aquí abajo es la única barrera real de
 * secuencia y de rol; HU-17 la duplica en la base.
 */

/** Lo que la action le devuelve al botón. */
export type EstadoMarcado = {
  ok: boolean;
  mensaje: string;
};

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
