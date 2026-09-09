"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  obtenerMarcadosDeLaOrden,
  obtenerUsuariosDeSecretaria,
} from "@/features/documentos/queries";
import { validarCierre, validarReporte } from "@/features/documentos/reglas";
import {
  cierreSchema,
  facturaSchema,
  reporteSimpleSchema,
} from "@/features/documentos/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-13 · Cerrar una orden.
 *
 * Son tres reportes por separado —etiquetas, documentos de despacho y factura—
 * y, cuando están los tres, la marca de que la orden quedó completada. Cada uno
 * es su propia action porque ocurren en momentos distintos.
 *
 * Todas siguen el mismo orden: el esquema revisa lo que llegó, las reglas del
 * cierre le preguntan al motor de workflow si la orden está en el punto que
 * corresponde (regla 2: ninguna action inserta en `avance_seccion` por su
 * cuenta), y la base vuelve a comprobarlo —con el índice único y con el trigger
 * que congela las órdenes completadas—, porque una server action se puede
 * invocar con un POST directo sin pasar por la pantalla.
 *
 * Quién reporta se escoge de una lista mientras no exista el login (HU-16):
 * `avance_seccion.usuario_id` es obligatorio. HU-17 lo reemplaza por la sesión.
 */

export type ResultadoCierre = {
  ok: boolean;
  mensaje: string;
};

/** Violación de unicidad: ese reporte ya estaba. */
const DUPLICADO = "23505";
/** La orden ya está completada (trigger). */
const ORDEN_COMPLETADA = "UE004";
/** La orden no existe. */
const ORDEN_INEXISTENTE = "UE005";

function fallo(mensaje: string): ResultadoCierre {
  return { ok: false, mensaje };
}

/** Traduce los errores que ya sabemos leer; el resto se registra y se avisa. */
function mensajeConocido(codigo: string | undefined): string | null {
  switch (codigo) {
    case ORDEN_COMPLETADA:
      return "La orden ya está completada, así que no admite más cambios.";
    case ORDEN_INEXISTENTE:
      return "No encontramos esa orden.";
    case DUPLICADO:
      return "Eso ya estaba reportado.";
    default:
      return null;
  }
}

/** Solo la secretaría reporta el cierre; HU-17 lo hará con la sesión. */
async function esDeSecretaria(usuarioId: string): Promise<boolean> {
  const secretarias = await obtenerUsuariosDeSecretaria();
  return secretarias.some((persona) => persona.id === usuarioId);
}

function actualizarPantallas(ordenId: string) {
  revalidatePath("/ordenes/cierre");
  revalidatePath("/tablero");
  revalidatePath(`/tablero/${ordenId}`);
}

export async function reportarParteDelCierre(
  _estadoPrevio: ResultadoCierre,
  formData: FormData,
): Promise<ResultadoCierre> {
  const validacion = reporteSimpleSchema.safeParse({
    ordenId: formData.get("ordenId"),
    usuarioId: formData.get("usuarioId"),
    reporte: formData.get("reporte"),
  });

  if (!validacion.success) {
    const [primero] = z.flattenError(validacion.error).formErrors;
    const porCampo = Object.values(
      z.flattenError(validacion.error).fieldErrors,
    ).flat();

    return fallo(primero ?? porCampo[0] ?? "No se pudo registrar el reporte.");
  }

  const { ordenId, usuarioId, reporte } = validacion.data;

  const marcados = await obtenerMarcadosDeLaOrden(ordenId);
  const permiso = validarReporte({
    ordenExiste: marcados !== null,
    marcados: marcados ?? [],
    reporte,
  });

  if (!permiso.permitido) return fallo(permiso.mensaje);

  if (!(await esDeSecretaria(usuarioId))) {
    return fallo("El cierre lo reporta la secretaría.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("avance_seccion")
    .insert({ orden_id: ordenId, checkpoint: reporte, usuario_id: usuarioId });

  if (error) {
    const conocido = mensajeConocido(error.code);
    if (conocido) return fallo(conocido);

    console.error("[HU-13] No se pudo registrar el reporte", error);
    return fallo("No se pudo registrar el reporte. Vuelve a intentarlo.");
  }

  actualizarPantallas(ordenId);

  return { ok: true, mensaje: "Reporte guardado." };
}

export async function reportarFactura(
  _estadoPrevio: ResultadoCierre,
  formData: FormData,
): Promise<ResultadoCierre> {
  const validacion = facturaSchema.safeParse({
    ordenId: formData.get("ordenId"),
    usuarioId: formData.get("usuarioId"),
    numeroFactura: formData.get("numeroFactura"),
  });

  if (!validacion.success) {
    const porCampo = Object.values(
      z.flattenError(validacion.error).fieldErrors,
    ).flat();

    return fallo(porCampo[0] ?? "No se pudo registrar la factura.");
  }

  const { ordenId, usuarioId, numeroFactura } = validacion.data;

  const marcados = await obtenerMarcadosDeLaOrden(ordenId);
  const permiso = validarReporte({
    ordenExiste: marcados !== null,
    marcados: marcados ?? [],
    reporte: "factura_generada",
  });

  if (!permiso.permitido) return fallo(permiso.mensaje);

  if (!(await esDeSecretaria(usuarioId))) {
    return fallo("El cierre lo reporta la secretaría.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("reportar_factura", {
    p_orden_id: ordenId,
    p_numero_factura: numeroFactura,
    p_usuario_id: usuarioId,
  });

  if (error) {
    const conocido = mensajeConocido(error.code);
    if (conocido) return fallo(conocido);

    console.error("[HU-13] No se pudo reportar la factura", error);
    return fallo("No se pudo guardar la factura. Vuelve a intentarlo.");
  }

  actualizarPantallas(ordenId);

  return { ok: true, mensaje: `Factura ${numeroFactura} registrada.` };
}

export async function cerrarOrden(
  _estadoPrevio: ResultadoCierre,
  formData: FormData,
): Promise<ResultadoCierre> {
  const validacion = cierreSchema.safeParse({
    ordenId: formData.get("ordenId"),
    usuarioId: formData.get("usuarioId"),
  });

  if (!validacion.success) {
    const porCampo = Object.values(
      z.flattenError(validacion.error).fieldErrors,
    ).flat();

    return fallo(porCampo[0] ?? "No se pudo completar la orden.");
  }

  const { ordenId, usuarioId } = validacion.data;

  const marcados = await obtenerMarcadosDeLaOrden(ordenId);
  const permiso = validarCierre({
    ordenExiste: marcados !== null,
    marcados: marcados ?? [],
  });

  if (!permiso.permitido) return fallo(permiso.mensaje);

  if (!(await esDeSecretaria(usuarioId))) {
    return fallo("El cierre lo reporta la secretaría.");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("avance_seccion").insert({
    orden_id: ordenId,
    checkpoint: "cerrada",
    usuario_id: usuarioId,
  });

  if (error) {
    const conocido = mensajeConocido(error.code);
    if (conocido) return fallo(conocido);

    console.error("[HU-13] No se pudo completar la orden", error);
    return fallo("No se pudo completar la orden. Vuelve a intentarlo.");
  }

  actualizarPantallas(ordenId);

  return { ok: true, mensaje: "Orden completada." };
}
