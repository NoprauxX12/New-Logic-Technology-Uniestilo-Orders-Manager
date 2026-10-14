"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ENTRADA_AVISO_VACIA,
  leerFormularioAviso,
  leerOrdenId,
  type EntradaAvisoTela,
} from "@/features/alertas/formulario";
import {
  obtenerAdministradores,
  obtenerSituacionParaAviso,
} from "@/features/alertas/queries";
import {
  destinatarioDeAlertaTela,
  puedeAvisarFaltaDeTela,
} from "@/features/alertas/reglas";
import { avisarFaltaDeTelaSchema } from "@/features/alertas/schemas";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-06 · Avisar a administración que falta tela para una orden.
 *
 * Única vía para crear una alerta de tela. El orden de las verificaciones es el
 * mismo de las demás actions del proyecto:
 *
 * 1. El esquema revisa lo que se escribió (el detalle es obligatorio).
 * 2. La persona sale de la sesión (HU-16), nunca de un campo del formulario.
 * 3. Las reglas de la feature comprueban el rol, el punto en que va la orden y
 *    que no haya ya un aviso pendiente.
 * 4. La base repite lo importante: RLS exige el rol, la firma y que el
 *    destinatario sea de administración, y el índice único impide el aviso
 *    doble aunque dos personas lo manden a la vez.
 *
 * Avisar no marca ningún checkpoint: una alerta es entidad propia con
 * destinatario y estado (regla 7), y la atiende administración en HU-07.
 */

/** Lo que la action le devuelve al formulario. */
export type EstadoFormularioAviso = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[] | undefined>;
  valores: EntradaAvisoTela;
};

/** Violación del índice único: ya hay un aviso de tela pendiente. */
const VIOLACION_DE_UNICIDAD = "23505";
/** RLS rechazó la fila: el rol, la firma o el destinatario no corresponden. */
const RLS_RECHAZO = "42501";

function fallo(
  mensaje: string,
  valores: EntradaAvisoTela,
): EstadoFormularioAviso {
  return { ok: false, mensaje, errores: {}, valores };
}

export async function avisarFaltaDeTela(
  _estadoPrevio: EstadoFormularioAviso,
  formData: FormData,
): Promise<EstadoFormularioAviso> {
  const escrito = leerFormularioAviso(formData);
  const validacion = avisarFaltaDeTelaSchema.safeParse({
    ...escrito,
    ordenId: leerOrdenId(formData),
  });

  if (!validacion.success) {
    const errores = z.flattenError(validacion.error).fieldErrors;

    // Un ordenId inválido no es algo que la persona pueda corregir en un campo.
    if (errores.ordenId) {
      return fallo(
        "No se pudo identificar la orden. Vuelve a abrir la pantalla.",
        escrito,
      );
    }

    return {
      ok: false,
      mensaje: "Revisa el campo marcado en rojo.",
      errores,
      valores: escrito,
    };
  }

  const { ordenId, detalle } = validacion.data;

  const usuario = await getUsuarioActual();

  if (!usuario) {
    return fallo("Inicia sesión para avisar que falta tela.", escrito);
  }

  const [situacion, administradores] = await Promise.all([
    obtenerSituacionParaAviso(ordenId),
    obtenerAdministradores(),
  ]);

  if (!situacion) return fallo("No encontramos esa orden.", escrito);

  const permiso = puedeAvisarFaltaDeTela({
    marcados: situacion.marcados,
    tieneAlertaAbierta: situacion.tieneAlertaAbierta,
    rol: usuario.rol,
  });

  if (!permiso.permitido) return fallo(permiso.mensaje, escrito);

  const destinatarioId = destinatarioDeAlertaTela(administradores);

  if (!destinatarioId) {
    console.error("[HU-06] No hay ninguna cuenta de administración activa");
    return fallo(
      "No hay nadie en administración para recibir el aviso. Pide que activen una cuenta.",
      escrito,
    );
  }

  const supabase = await createClient();

  // `fecha_creacion` la pone el `default now()` de la columna, no el navegador:
  // una hora que viniera del cliente sería falsificable (RNF-05).
  const { error } = await supabase.from("alerta").insert({
    tipo: "falta_tela",
    orden_id: ordenId,
    destinatario_id: destinatarioId,
    creada_por: usuario.id,
    detalle,
  });

  if (error) {
    if (error.code === VIOLACION_DE_UNICIDAD) {
      revalidatePath("/ordenes/telas");
      return fallo(
        "Otra persona ya avisó que falta tela en esta orden.",
        ENTRADA_AVISO_VACIA,
      );
    }

    if (error.code === RLS_RECHAZO) {
      return fallo("La falta de tela la avisa Secretaría.", escrito);
    }

    console.error("[HU-06] No se pudo crear la alerta", error);
    return fallo("No se pudo enviar el aviso. Vuelve a intentarlo.", escrito);
  }

  revalidatePath("/ordenes/telas");
  revalidatePath("/tablero");

  return {
    ok: true,
    mensaje: `Aviso enviado a administración por la orden ${situacion.numeroOrdenCompra}.`,
    errores: {},
    valores: ENTRADA_AVISO_VACIA,
  };
}
