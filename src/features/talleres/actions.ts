"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ENTRADA_VACIA,
  leerFormularioDespacho,
  leerOrdenId,
  type EntradaDespacho,
} from "@/features/talleres/formulario";
import {
  obtenerOrdenParaDespacho,
  obtenerUsuariosDeLogistica,
} from "@/features/talleres/queries";
import { puedeDespachar } from "@/features/talleres/reglas";
import { despacharLoteSchema } from "@/features/talleres/schemas";
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
