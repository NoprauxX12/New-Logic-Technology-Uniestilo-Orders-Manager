"use server";

import { revalidatePath } from "next/cache";

import { programarTelaSchema } from "@/features/ordenes/telaSchemas";
import { obtenerSituacionDeOrden } from "@/features/workflow/queries";
import { puedeMarcar } from "@/features/workflow/transiciones";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

export type EstadoProgramarTela = {
  ok: boolean;
  mensaje: string;
};

export async function programarTela(
  _estadoPrevio: EstadoProgramarTela,
  formData: FormData,
): Promise<EstadoProgramarTela> {
  const usuario = await getUsuarioActual();

  if (!usuario) {
    return { ok: false, mensaje: "Inicia sesión para programar la tela." };
  }

  if (usuario.rol !== "secretaria") {
    return {
      ok: false,
      mensaje: "Solo secretaría puede programar la tela.",
    };
  }

  const validacion = programarTelaSchema.safeParse({
    ordenId: formData.get("ordenId"),
    items: formData.getAll("itemId").map((itemId) => ({
      itemId,
      tipoTela: formData.get(`${itemId}.tipoTela`),
      cantidadTela: formData.get(`${itemId}.cantidadTela`),
      unidadTela: formData.get(`${itemId}.unidadTela`),
      observacionesTela: formData.get(`${itemId}.observacionesTela`) ?? "",
    })),
  });

  if (!validacion.success) {
    return {
      ok: false,
      mensaje:
        validacion.error.issues[0]?.message ??
        "Revisa los datos de tela de cada prenda.",
    };
  }

  const { ordenId, items } = validacion.data;
  const situacion = await obtenerSituacionDeOrden(ordenId);

  if (!situacion) {
    return { ok: false, mensaje: "La orden indicada no existe." };
  }

  if (!situacion.marcados.includes("ficha_adjunta")) {
    return {
      ok: false,
      mensaje: "Primero debe estar marcada la ficha técnica de la orden.",
    };
  }

  const veredicto = puedeMarcar({
    checkpoint: "tela_programada",
    marcados: situacion.marcados,
    rol: usuario.rol,
  });

  if (!veredicto.permitido) {
    return { ok: false, mensaje: veredicto.mensaje };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("programar_tela", {
    p_orden_id: ordenId,
    p_items: items.map((item) => ({
      item_id: item.itemId,
      tipo_tela: item.tipoTela,
      cantidad_tela: item.cantidadTela,
      unidad_tela: item.unidadTela,
      observaciones_tela: item.observacionesTela ?? "",
    })),
  });

  if (error) {
    console.error("No se pudo programar la tela", error);

    return {
      ok: false,
      mensaje:
        "No se pudo programar la tela. Actualiza la página y revisa si la orden sigue pendiente.",
    };
  }

  revalidatePath("/ordenes/tela");
  revalidatePath("/ordenes/corte");
  revalidatePath(`/tablero/${ordenId}`);
  revalidatePath("/tablero");

  return {
    ok: true,
    mensaje:
      "Tela programada correctamente. Ahora la orden puede pasar a corte.",
  };
}
