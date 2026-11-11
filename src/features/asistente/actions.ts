"use server";

import { crearHerramientas } from "@/features/asistente/herramientas";
import {
  pendientesParaModelo,
  redactarResumenSinIA,
} from "@/features/asistente/pendientes";
import {
  instruccionesDelResumen,
  instruccionesDelSistema,
  pedidoDelResumen,
} from "@/features/asistente/prompt";
import { leerPendientes } from "@/features/asistente/queries";
import { puedeUsarAsistente } from "@/features/asistente/reglas";
import { conversacionSchema } from "@/features/asistente/schemas";
import {
  FalloDelModelo,
  leerConfigIA,
  responderConHerramientas,
  type MensajeChat,
  type TipoFalloModelo,
} from "@/lib/ai";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

/**
 * HU-15 · La pregunta de administración al asistente. Abajo, el resumen
 * proactivo de HU-21.
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
const MENSAJE_POR_FALLO: Record<TipoFalloModelo, string> = {
  ocupado:
    "El asistente está ocupado: el proveedor de IA puso un límite por minuto. Espera un momento y vuelve a preguntar.",
  tiempo:
    "El asistente tardó demasiado en responder. Intenta con una pregunta más corta.",
  proveedor:
    "El asistente no pudo responder en este momento. Intenta de nuevo en un momento.",
};
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
    const tipo = error instanceof FalloDelModelo ? error.tipo : "proveedor";
    console.error(`[asistente] El modelo no respondió (${tipo})`, error);
    return { ok: false, mensaje: MENSAJE_POR_FALLO[tipo] };
  }
}

const SIN_PENDIENTES_LEIDOS =
  "No pude revisar lo pendiente en este momento. Puedes preguntarme por una orden igual.";

/**
 * HU-21 · Lo que el asistente le señala a administración al abrir el panel,
 * sin que pregunte: órdenes atrasadas, en riesgo y detenidas, alertas sin
 * atender y sugerencias de qué hacer, en condicional y sin decidir por nadie.
 *
 * Los pendientes se leen y se clasifican aquí, en el servidor; el modelo solo
 * los redacta. Si no hay nada pendiente no se le pregunta (no hay qué
 * redactar), y si no está configurado o no responde, se devuelve el resumen
 * armado sin IA con los mismos datos: el asistente señala igual aunque el
 * proveedor falle.
 */
export async function resumenProactivo(): Promise<RespuestaAsistente> {
  const usuario = await getUsuarioActual();
  if (!usuario || !puedeUsarAsistente(usuario.rol)) {
    return { ok: false, mensaje: SIN_ACCESO };
  }

  const ahora = new Date();

  let datos: ReturnType<typeof pendientesParaModelo>;
  try {
    datos = pendientesParaModelo(await leerPendientes(ahora), ahora);
  } catch (error) {
    console.error("[asistente] No se pudo leer lo pendiente", error);
    return { ok: false, mensaje: SIN_PENDIENTES_LEIDOS };
  }

  const sinIA = redactarResumenSinIA(datos);
  if (datos.alDia) return { ok: true, texto: sinIA };

  const config = leerConfigIA();
  if (!config.ok) {
    console.error("[asistente]", config.motivo);
    return { ok: true, texto: sinIA };
  }

  try {
    const respuesta = await responderConHerramientas({
      sistema: instruccionesDelResumen(ahora),
      mensajes: [{ rol: "usuario", contenido: pedidoDelResumen(datos) }],
      herramientas: {},
      config: config.config,
    });

    return { ok: true, texto: respuesta.texto || sinIA };
  } catch (error) {
    const tipo = error instanceof FalloDelModelo ? error.tipo : "proveedor";
    console.error(
      `[asistente] El modelo no redactó el resumen (${tipo}); va el resumen sin IA`,
      error,
    );
    return { ok: true, texto: sinIA };
  }
}
