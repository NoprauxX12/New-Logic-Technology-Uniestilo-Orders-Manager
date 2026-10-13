"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { obtenerMarcadosDeLaOrden } from "@/features/documentos/queries";
import { validarCierre, validarReporte } from "@/features/documentos/reglas";
import {
  cierreSchema,
  facturaSchema,
  reporteSimpleSchema,
} from "@/features/documentos/schemas";
import { getUsuarioActual, type UsuarioActual } from "@/lib/auth/usuarioActual";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-13 · Cerrar una orden.
 *
 * Son tres reportes por separado —etiquetas, documentos de despacho y factura—
 * y, cuando están los tres, la marca de que la orden quedó completada. Cada uno
 * es su propia action porque ocurren en momentos distintos.
 *
 * Todas siguen el mismo orden: el esquema revisa lo que llegó, se identifica a
 * la persona con sesión (HU-16), las reglas del cierre le preguntan al motor de
 * workflow si la orden está en el punto que corresponde y si el rol de quien
 * reporta es el dueño (regla 2), y la base vuelve a comprobarlo con las
 * políticas RLS (HU-17), el índice único y el trigger que congela las órdenes
 * completadas, porque una server action se puede invocar con un POST directo.
 *
 * Quién reporta nunca viene del formulario: sale de la sesión. Un campo oculto
 * lo puede cambiar cualquiera, y la bitácora tiene que ser confiable (RNF-05).
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
/** RLS rechazó la fila: el rol o la firma no corresponden. */
const RLS_RECHAZO = "42501";

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
    case RLS_RECHAZO:
      return "El cierre lo reporta la secretaría.";
    default:
      return null;
  }
}

function primerError(error: z.ZodError, porDefecto: string): string {
  const { formErrors, fieldErrors } = z.flattenError(error);
  return formErrors[0] ?? Object.values(fieldErrors).flat()[0] ?? porDefecto;
}

function actualizarPantallas(ordenId: string) {
  revalidatePath("/ordenes/cierre");
  revalidatePath("/tablero");
  revalidatePath(`/tablero/${ordenId}`);
}

type Situacion = {
  usuario: UsuarioActual;
  marcados: Awaited<ReturnType<typeof obtenerMarcadosDeLaOrden>>;
};

/** La persona con sesión y lo que la orden lleva marcado, o el mensaje de por qué no. */
async function situacionDe(
  ordenId: string,
): Promise<Situacion | ResultadoCierre> {
  const usuario = await getUsuarioActual();
  if (!usuario) return fallo("Inicia sesión para reportar el cierre.");

  const marcados = await obtenerMarcadosDeLaOrden(ordenId);
  return { usuario, marcados };
}

function esFallo(valor: Situacion | ResultadoCierre): valor is ResultadoCierre {
  return "ok" in valor;
}

export async function reportarParteDelCierre(
  _estadoPrevio: ResultadoCierre,
  formData: FormData,
): Promise<ResultadoCierre> {
  const validacion = reporteSimpleSchema.safeParse({
    ordenId: formData.get("ordenId"),
    reporte: formData.get("reporte"),
  });

  if (!validacion.success) {
    return fallo(
      primerError(validacion.error, "No se pudo registrar el reporte."),
    );
  }

  const { ordenId, reporte } = validacion.data;

  const situacion = await situacionDe(ordenId);
  if (esFallo(situacion)) return situacion;
  const { usuario, marcados } = situacion;

  const permiso = validarReporte({
    ordenExiste: marcados !== null,
    marcados: marcados ?? [],
    reporte,
    rol: usuario.rol,
  });

  if (!permiso.permitido) return fallo(permiso.mensaje);

  const supabase = await createClient();

  const { error } = await supabase
    .from("avance_seccion")
    .insert({ orden_id: ordenId, checkpoint: reporte, usuario_id: usuario.id });

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
    numeroFactura: formData.get("numeroFactura"),
  });

  if (!validacion.success) {
    return fallo(
      primerError(validacion.error, "No se pudo registrar la factura."),
    );
  }

  const { ordenId, numeroFactura } = validacion.data;

  const situacion = await situacionDe(ordenId);
  if (esFallo(situacion)) return situacion;
  const { usuario, marcados } = situacion;

  const permiso = validarReporte({
    ordenExiste: marcados !== null,
    marcados: marcados ?? [],
    reporte: "factura_generada",
    rol: usuario.rol,
  });

  if (!permiso.permitido) return fallo(permiso.mensaje);

  const supabase = await createClient();

  // La función toma a la persona de la sesión (`auth.uid()`): no se le manda.
  const { error } = await supabase.rpc("reportar_factura", {
    p_orden_id: ordenId,
    p_numero_factura: numeroFactura,
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
  });

  if (!validacion.success) {
    return fallo(
      primerError(validacion.error, "No se pudo completar la orden."),
    );
  }

  const { ordenId } = validacion.data;

  const situacion = await situacionDe(ordenId);
  if (esFallo(situacion)) return situacion;
  const { usuario, marcados } = situacion;

  const permiso = validarCierre({
    ordenExiste: marcados !== null,
    marcados: marcados ?? [],
    rol: usuario.rol,
  });

  if (!permiso.permitido) return fallo(permiso.mensaje);

  const supabase = await createClient();

  const { error } = await supabase.from("avance_seccion").insert({
    orden_id: ordenId,
    checkpoint: "cerrada",
    usuario_id: usuario.id,
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
