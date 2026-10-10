"use server";

import { crearHerramientas } from "@/features/asistente/herramientas";
import { instruccionesDelSistema } from "@/features/asistente/prompt";
import { puedeUsarAsistente } from "@/features/asistente/reglas";
import { conversacionSchema } from "@/features/asistente/schemas";
import {
  leerConfigIA,
  responderConHerramientas,
  type MensajeChat,
} from "@/lib/ai";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

/**
 * HU-15 · La pregunta de administración al asistente.
 *
 * Es una Server Action y no un route handler porque aquí vive la lógica de la
 * aplicación (CLAUDE.md: route handlers solo para webhooks, cron y health).
 * No muta nada: lee la sesión, valida la conversación y le pasa al modelo las
 * herramientas de solo lectura.
 *
 * Quién pregunta sale de la sesión, nunca del formulario (regla 6); el rol se
 * comprueba aquí aunque el layout ya haya escondido el panel (regla 5).
 */

export type RespuestaAsistente =
  { ok: true; texto: string } | { ok: false; mensaje: string };

const SIN_ACCESO = "El asistente es solo para administración.";
const NO_CONFIGURADO =
  "El asistente no está configurado. Pídele a quien administra el sistema que complete las variables de IA.";
const FALLO =
  "El asistente no pudo responder en este momento. Intenta de nuevo en un momento.";
const SIN_TEXTO =
  "No encontré qué responder. Prueba con el número de la orden o el nombre del cliente.";

export async function preguntarAlAsistente(
  conversacion: MensajeChat[],
): Promise<RespuestaAsistente> {
  const usuario = await getUsuarioActual();
  if (!usuario || !puedeUsarAsistente(usuario.rol)) {
    return { ok: false, mensaje: SIN_ACCESO };
  }

  const entrada = conversacionSchema.safeParse(conversacion);
  if (!entrada.success) {
    return {
      ok: false,
      mensaje: entrada.error.issues[0]?.message ?? "Escribe una pregunta.",
    };
  }

  const config = leerConfigIA();
  if (!config.ok) {
    console.error("[asistente]", config.motivo);
    return { ok: false, mensaje: NO_CONFIGURADO };
  }

  try {
    const ahora = new Date();
    const respuesta = await responderConHerramientas({
      sistema: instruccionesDelSistema(ahora),
      mensajes: entrada.data,
      herramientas: crearHerramientas(ahora),
      config: config.config,
    });

    if (!respuesta.texto) return { ok: false, mensaje: SIN_TEXTO };
    return { ok: true, texto: respuesta.texto };
  } catch (error) {
    console.error("[asistente] El modelo no respondió", error);
    return { ok: false, mensaje: FALLO };
  }
}
