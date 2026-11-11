"use server";

import { revalidatePath } from "next/cache";

import { leerFormularioInsumos } from "@/features/insumos/formulario";
import { puedeValidarInsumos } from "@/features/insumos/reglas";
import { validarInsumosSchema } from "@/features/insumos/schemas";
import { obtenerSituacionDeOrden } from "@/features/workflow/queries";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-23 · Secretaría valida los insumos de una orden.
 *
 * Guarda el listado y marca `insumos_validados` en una sola llamada a
 * `validar_insumos` (ADR 0005). Antes le pregunta al motor de workflow con los
 * avances frescos de la base (regla 2); quién valida sale de la sesión, nunca
 * del formulario (regla 6). La base repite rol, secuencia y listado.
 */

export type EstadoInsumos = {
  ok: boolean;
  mensaje: string;
};

export async function validarInsumos(
  _estadoPrevio: EstadoInsumos,
  formData: FormData,
): Promise<EstadoInsumos> {
  const usuario = await getUsuarioActual();

  if (!usuario) {
    return { ok: false, mensaje: "Inicia sesión para validar los insumos." };
  }

  const validacion = validarInsumosSchema.safeParse(
    leerFormularioInsumos(formData),
  );

  if (!validacion.success) {
    return {
      ok: false,
      mensaje:
        validacion.error.issues[0]?.message ??
        "Revisa los insumos de la orden.",
    };
  }

  const { ordenId, insumos } = validacion.data;
  const situacion = await obtenerSituacionDeOrden(ordenId);

  if (!situacion) {
    return { ok: false, mensaje: "La orden indicada no existe." };
  }

  const veredicto = puedeValidarInsumos(
    situacion.marcados,
    usuario.rol,
    situacion.etapaInicial,
  );

  if (!veredicto.permitido) {
    return { ok: false, mensaje: veredicto.mensaje };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("validar_insumos", {
    p_orden_id: ordenId,
    p_insumos: insumos,
  });

  if (error) {
    console.error("[HU-23] No se pudieron validar los insumos", error);
    return {
      ok: false,
      mensaje:
        "No se pudieron validar los insumos. Actualiza la página y revisa si la orden sigue pendiente.",
    };
  }

  revalidatePath("/ordenes/insumos");
  revalidatePath(`/ordenes/insumos/${ordenId}`);
  revalidatePath("/ordenes/corte");
  revalidatePath(`/tablero/${ordenId}`);
  revalidatePath("/tablero");

  return {
    ok: true,
    mensaje: "Insumos validados. La orden ya puede pasar a corte.",
  };
}
