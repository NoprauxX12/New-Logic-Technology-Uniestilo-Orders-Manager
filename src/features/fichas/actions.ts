"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adjuntarFichaSchema } from "@/features/fichas/schemas";
import { marcarCheckpoint } from "@/features/workflow/actions";
import { obtenerSituacionDeOrden } from "@/features/workflow/queries";
import { puedeMarcar } from "@/features/workflow/transiciones";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { BUCKET_FICHAS, rutaDeArchivo } from "@/lib/storage/fichas";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-04 · Adjuntar la ficha técnica a una orden.
 *
 * Sube el archivo a Storage, guarda la ruta en `ficha_tecnica` y, si todavía
 * no estaba, marca el checkpoint `ficha_adjunta` por el motor de workflow
 * (regla 2). Una orden ya marcada puede recibir otra versión del archivo:
 * no hay unicidad sobre `orden_id`.
 *
 * Quién sube sale de la sesión, nunca del formulario (RNF-05). RLS exige
 * `diseno` y que `subida_por` sea quien tiene la sesión.
 */

export type ResultadoFicha = {
  ok: boolean;
  mensaje: string;
};

const RLS_RECHAZO = "42501";

function fallo(mensaje: string): ResultadoFicha {
  return { ok: false, mensaje };
}

function primerError(error: z.ZodError, porDefecto: string): string {
  const { formErrors, fieldErrors } = z.flattenError(error);
  return formErrors[0] ?? Object.values(fieldErrors).flat()[0] ?? porDefecto;
}

export async function adjuntarFichaTecnica(
  _estadoPrevio: ResultadoFicha,
  formData: FormData,
): Promise<ResultadoFicha> {
  const bruto = formData.get("archivo");
  const validacion = adjuntarFichaSchema.safeParse({
    ordenId: formData.get("ordenId"),
    archivo: bruto instanceof File ? bruto : undefined,
  });

  if (!validacion.success) {
    return fallo(
      primerError(validacion.error, "No se pudo adjuntar la ficha técnica."),
    );
  }

  const { ordenId, archivo } = validacion.data;

  const usuario = await getUsuarioActual();
  if (!usuario) return fallo("Inicia sesión para adjuntar la ficha técnica.");

  if (usuario.rol !== "diseno") {
    return fallo("La ficha técnica la adjunta Diseño.");
  }

  const situacion = await obtenerSituacionDeOrden(ordenId);
  if (!situacion) return fallo("No encontramos esa orden.");

  const yaMarcada = situacion.marcados.includes("ficha_adjunta");

  if (!yaMarcada) {
    const veredicto = puedeMarcar({
      checkpoint: "ficha_adjunta",
      marcados: situacion.marcados,
      rol: usuario.rol,
      etapaInicial: situacion.etapaInicial,
      recepcionConfirmada: situacion.recepcionConfirmada,
    });

    if (!veredicto.permitido) return fallo(veredicto.mensaje);
  }

  const ruta = rutaDeArchivo(ordenId, archivo.name);
  const supabase = await createClient();

  const { error: errorStorage } = await supabase.storage
    .from(BUCKET_FICHAS)
    .upload(ruta, archivo, {
      contentType: archivo.type || "application/octet-stream",
      upsert: false,
    });

  if (errorStorage) {
    console.error("[HU-04] No se pudo subir la ficha a Storage", errorStorage);
    return fallo("No se pudo subir la ficha. Vuelve a intentarlo.");
  }

  const { error } = await supabase.from("ficha_tecnica").insert({
    orden_id: ordenId,
    archivo_ruta: ruta,
    subida_por: usuario.id,
  });

  if (error?.code === RLS_RECHAZO) {
    return fallo("La ficha técnica la adjunta Diseño.");
  }

  if (error) {
    console.error("[HU-04] No se pudo registrar la ficha", error);
    return fallo("No se pudo guardar la ficha. Vuelve a intentarlo.");
  }

  if (!yaMarcada) {
    const marcado = await marcarCheckpoint(ordenId, "ficha_adjunta");
    if (!marcado.ok) {
      revalidatePath("/ordenes/diseno");
      revalidatePath("/tablero");
      revalidatePath(`/tablero/${ordenId}`);
      return fallo(
        "La ficha se subió, pero no se pudo marcar la etapa. Vuelve a intentarlo.",
      );
    }
  }

  revalidatePath("/ordenes/diseno");
  revalidatePath("/tablero");
  revalidatePath(`/tablero/${ordenId}`);

  return {
    ok: true,
    mensaje: yaMarcada
      ? "Ficha técnica adjuntada."
      : "Ficha técnica adjuntada. La orden ya puede seguir.",
  };
}
