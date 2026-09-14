"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ENTRADA_RECEPCION_VACIA,
  ENTRADA_VACIA,
  leerFormularioDespacho,
  leerFormularioRecepcion,
  leerLoteId,
  leerOrdenId,
  type EntradaDespacho,
  type EntradaRecepcion,
} from "@/features/talleres/formulario";
import {
  obtenerOrdenParaDespacho,
  obtenerUsuariosDeLogistica,
} from "@/features/talleres/queries";
import {
  puedeConfirmarRecepcion,
  puedeDespachar,
} from "@/features/talleres/reglas";
import {
  confirmarRecepcionSchema,
  despacharLoteSchema,
} from "@/features/talleres/schemas";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-10 · Despachar un lote a un taller satélite.
 *
 * Única vía para registrar un despacho. El orden de las verificaciones no es
 * casual:
 *
 * 1. El esquema revisa lo que se escribió (taller obligatorio).
 * 2. Las reglas de la feature comprueban que el corte esté completado, y que
 *    quien despacha sea de logística. Esto último lo hará HU-17 con la sesión;
 *    mientras tanto se valida contra la lista de usuarios de ese rol.
 * 3. La base vuelve a comprobar el corte con un trigger, porque una server
 *    action se puede invocar con un POST directo sin pasar por el formulario.
 *
 * Despachar no marca ningún checkpoint: un lote es entidad propia (regla 6) y
 * el enum `checkpoint` no incluye el despacho. Que la orden esté "en confección"
 * se deriva de tener lotes todavía en el taller.
 */

/** Lo que la action le devuelve al formulario. */
export type EstadoFormularioDespacho = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[] | undefined>;
  valores: EntradaDespacho;
};

/** El trigger que exige el corte completado. */
const CORTE_SIN_COMPLETAR = "UE001";
/** La orden o el usuario referenciados no existen. */
const REFERENCIA_INEXISTENTE = "23503";

export async function despacharLote(
  _estadoPrevio: EstadoFormularioDespacho,
  formData: FormData,
): Promise<EstadoFormularioDespacho> {
  const escrito = leerFormularioDespacho(formData);
  const ordenId = leerOrdenId(formData);

  const validacion = despacharLoteSchema.safeParse({ ...escrito, ordenId });

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados en rojo.",
      errores: z.flattenError(validacion.error).fieldErrors,
      valores: escrito,
    };
  }

  const despacho = validacion.data;

  const [orden, logistica] = await Promise.all([
    obtenerOrdenParaDespacho(despacho.ordenId),
    obtenerUsuariosDeLogistica(),
  ]);

  if (!orden) {
    return {
      ok: false,
      mensaje: "No encontramos esa orden.",
      errores: {},
      valores: escrito,
    };
  }

  const permiso = puedeDespachar(orden.marcados);

  if (!permiso.permitido) {
    return {
      ok: false,
      mensaje: permiso.mensaje,
      errores: {},
      valores: escrito,
    };
  }

  if (!logistica.some((persona) => persona.id === despacho.enviadoPor)) {
    return {
      ok: false,
      mensaje: "",
      errores: { enviadoPor: ["Quien despacha tiene que ser de logística"] },
      valores: escrito,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("lote_taller").insert({
    orden_id: despacho.ordenId,
    taller: despacho.taller,
    descripcion_prendas: despacho.descripcionPrendas,
    enviado_por: despacho.enviadoPor,
  });

  if (error) {
    if (error.code === CORTE_SIN_COMPLETAR) {
      return {
        ok: false,
        mensaje:
          "Esta orden todavía no tiene el corte completado, así que no se puede despachar.",
        errores: {},
        valores: escrito,
      };
    }

    if (error.code === REFERENCIA_INEXISTENTE) {
      return {
        ok: false,
        mensaje: "No encontramos esa orden o esa persona.",
        errores: {},
        valores: escrito,
      };
    }

    console.error("[HU-10] No se pudo despachar el lote", error);
    return {
      ok: false,
      mensaje: "No se pudo registrar el despacho. Vuelve a intentarlo.",
      errores: {},
      valores: escrito,
    };
  }

  // La pantalla de la orden tiene que mostrar el taller recién guardado.
  revalidatePath(`/ordenes/${despacho.ordenId}`);

  return {
    ok: true,
    mensaje: `Lote despachado a ${despacho.taller}.`,
    errores: {},
    valores: ENTRADA_VACIA,
  };
}

/**
 * HU-11 · Confirmar la recepción de un lote que vuelve del taller.
 *
 * A diferencia del despacho, esto sí sale de la sesión (HU-16): logística ya
 * inicia sesión de verdad, así que no hace falta un desplegable de personas.
 *
 * Orden de verificaciones:
 * 1. El esquema revisa la forma del formulario.
 * 2. Hay alguien identificado y es de logística.
 * 3. El lote existe en esta orden y todavía no tiene recepción.
 * 4. La base respalda lo último con `lote_taller_recepcion_completa`: los tres
 *    campos de recepción van juntos o ninguno.
 */

/** Lo que la action le devuelve al formulario de recepción. */
export type EstadoFormularioRecepcion = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[] | undefined>;
  valores: EntradaRecepcion;
};

export async function confirmarRecepcion(
  _estadoPrevio: EstadoFormularioRecepcion,
  formData: FormData,
): Promise<EstadoFormularioRecepcion> {
  const escrito = leerFormularioRecepcion(formData);
  const loteId = leerLoteId(formData);
  const ordenId = leerOrdenId(formData);

  const validacion = confirmarRecepcionSchema.safeParse({
    loteId,
    ...escrito,
  });

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados en rojo.",
      errores: z.flattenError(validacion.error).fieldErrors,
      valores: escrito,
    };
  }

  const usuario = await getUsuarioActual();

  if (!usuario) {
    return {
      ok: false,
      mensaje: "Inicia sesión para confirmar una recepción.",
      errores: {},
      valores: escrito,
    };
  }

  if (usuario.rol !== "logistica") {
    return {
      ok: false,
      mensaje: "La recepción del taller la confirma logística.",
      errores: {},
      valores: escrito,
    };
  }

  const supabase = await createClient();

  const { data: lote, error: errorLote } = await supabase
    .from("lote_taller")
    .select("id, recibido_completo")
    .eq("id", validacion.data.loteId)
    .eq("orden_id", ordenId)
    .maybeSingle();

  if (errorLote) {
    console.error("[HU-11] No se pudo leer el lote", errorLote);
    return {
      ok: false,
      mensaje: "No se pudo consultar el lote. Vuelve a intentarlo.",
      errores: {},
      valores: escrito,
    };
  }

  const permiso = puedeConfirmarRecepcion(
    lote ? { recibido: lote.recibido_completo !== null } : undefined,
  );

  if (!permiso.permitido) {
    return {
      ok: false,
      mensaje: permiso.mensaje,
      errores: {},
      valores: escrito,
    };
  }

  const { error } = await supabase
    .from("lote_taller")
    .update({
      recibido_completo: validacion.data.completo,
      // No sale de `default now()` como en el despacho: la columna no tiene
      // default porque puede quedar en null largo tiempo. Se pone aquí, en el
      // servidor, no en el navegador: una hora que viniera del cliente sería
      // falsificable.
      fecha_recepcion: new Date().toISOString(),
      recibido_por: usuario.id,
      observaciones_recepcion: validacion.data.observaciones || null,
    })
    .eq("id", validacion.data.loteId);

  if (error) {
    console.error("[HU-11] No se pudo confirmar la recepción", error);
    return {
      ok: false,
      mensaje: "No se pudo confirmar la recepción. Vuelve a intentarlo.",
      errores: {},
      valores: escrito,
    };
  }

  // El estado de la orden en cuanto a talleres se deriva de sus lotes
  // (regla 1): con este lote recibido, "en confección" puede pasar a "todo
  // volvió", y eso se ve tanto en el detalle como en el tablero.
  revalidatePath(`/ordenes/${ordenId}`);
  revalidatePath("/tablero");

  return {
    ok: true,
    mensaje: validacion.data.completo
      ? "Recepción confirmada: llegó completo."
      : "Recepción confirmada, con faltantes anotados en las observaciones.",
    errores: {},
    valores: ENTRADA_RECEPCION_VACIA,
  };
}
