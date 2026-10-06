"use server";

import { revalidatePath } from "next/cache";

import {
  buscarCheckpoint,
  ETIQUETAS_ROL,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";
import { obtenerSituacionDeOrden } from "@/features/workflow/queries";
import { marcarAvanceSchema } from "@/features/workflow/schemas";
import { puedeMarcar } from "@/features/workflow/transiciones";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * Marcar un avance de una orden.
 *
 * Única vía para escribir en `avance_seccion` (regla 2): antes de insertar le
 * pregunta al motor si ese checkpoint es el siguiente de la secuencia, si el
 * rol de quien marca es el dueño de esa sección y si se cumple el requisito
 * extra que la etapa declare. Sirve igual para corte (HU-08), marcación
 * (HU-12), la salida a despacho (HU-19) y las que vengan: lo único que cambia
 * es el checkpoint.
 *
 * Hay dos puertas al mismo trabajo: `marcarAvance` recibe un FormData (para
 * `useActionState`) y `marcarCheckpoint` recibe los dos datos directos (para
 * una lista con un botón por orden).
 *
 * Nota de seguridad: una Server Action se puede invocar con un POST directo,
 * así que ni la persona ni los avances de la orden se toman de lo que llega en
 * el formulario. La persona sale de la sesión (HU-16) y los avances se leen de
 * la base. Las políticas RLS (HU-17) repiten la comprobación de rol y de firma
 * en la base, por si esta capa fallara.
 */

/** Lo que la action le devuelve a la pantalla. */
export type EstadoMarcado = {
  ok: boolean;
  mensaje: string;
};

/** Código de Postgres para "violación de restricción única". */
const VIOLACION_DE_UNICIDAD = "23505";
/** RLS rechazó la fila: el rol o la firma no corresponden. */
const RLS_RECHAZO = "42501";
/** La orden ya está completada (trigger de HU-13). */
const ORDEN_COMPLETADA = "UE004";

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
      "[workflow] Entrada inválida al marcar un avance",
      validacion.error.issues,
    );
    return {
      ok: false,
      mensaje:
        "No se pudo identificar la orden. Vuelve a abrirla desde el tablero.",
    };
  }

  return ejecutarMarcado(validacion.data);
}

export async function marcarCheckpoint(
  ordenId: string,
  checkpoint: CheckpointId,
): Promise<EstadoMarcado> {
  const validacion = marcarAvanceSchema.safeParse({ ordenId, checkpoint });

  if (!validacion.success) {
    return { ok: false, mensaje: "La orden seleccionada no es válida." };
  }

  return ejecutarMarcado(validacion.data);
}

async function ejecutarMarcado({
  ordenId,
  checkpoint,
}: {
  ordenId: string;
  checkpoint: CheckpointId;
}): Promise<EstadoMarcado> {
  const usuario = await getUsuarioActual();

  if (!usuario) {
    return { ok: false, mensaje: "Inicia sesión para poder marcar." };
  }

  const situacion = await obtenerSituacionDeOrden(ordenId);

  if (!situacion) {
    return { ok: false, mensaje: "La orden indicada no existe." };
  }

  const veredicto = puedeMarcar({
    checkpoint,
    marcados: situacion.marcados,
    rol: usuario.rol,
    recepcionConfirmada: situacion.recepcionConfirmada,
  });

  if (!veredicto.permitido) {
    return { ok: false, mensaje: veredicto.mensaje };
  }

  const { etiqueta, rolDueno, ruta } = buscarCheckpoint(checkpoint);
  const supabase = await createClient();

  // `fecha_hora` no se manda: la pone el `default now()` de la columna. Una hora
  // que viniera del navegador sería falsificable, y la bitácora tiene que ser
  // confiable (RNF-05).
  const { error } = await supabase.from("avance_seccion").insert({
    orden_id: ordenId,
    checkpoint,
    usuario_id: usuario.id,
  });

  if (error && error.code === RLS_RECHAZO) {
    return {
      ok: false,
      mensaje: `"${etiqueta}" lo marca ${ETIQUETAS_ROL[rolDueno]}.`,
    };
  }

  if (error && error.code === ORDEN_COMPLETADA) {
    return {
      ok: false,
      mensaje: "La orden ya está completada y no admite más cambios.",
    };
  }

  if (error && error.code !== VIOLACION_DE_UNICIDAD) {
    console.error("[workflow] No se pudo marcar el avance", error);
    return { ok: false, mensaje: "No se pudo marcar. Vuelve a intentarlo." };
  }

  // También se revalida cuando el insert chocó con el índice único: en ese caso
  // la base sí cambió —lo marcó otra persona— y la pantalla está mintiendo.
  if (ruta) revalidatePath(ruta);
  revalidatePath(`/tablero/${ordenId}`);
  revalidatePath("/tablero");

  if (error) {
    return {
      ok: false,
      mensaje: `"${etiqueta}" ya lo había marcado otra persona.`,
    };
  }

  const sigue = loQueSigue([...situacion.marcados, checkpoint]);

  return {
    ok: true,
    mensaje: sigue
      ? `Listo: ${etiqueta}. Ahora le toca a ${sigue.responsable}.`
      : `Listo: ${etiqueta}. La orden terminó su recorrido.`,
  };
}
