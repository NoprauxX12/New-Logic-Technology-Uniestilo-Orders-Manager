import "server-only";

import {
  generateText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from "ai";

import { leerConfigIA, type ConfigIA } from "@/lib/ai/config";
import { crearModelo } from "@/lib/ai/proveedor";

/**
 * HU-15 · La interfaz propia sobre el LLM (RNF-12). Las features hablan con
 * esto y con `herramienta()`; el SDK del proveedor vive en `proveedor.ts`.
 *
 * El modelo solo puede leer datos a través de las herramientas que recibe: la
 * capa no ofrece ninguna forma de escribir (regla 10, "la IA solo informa").
 */

export { tool as herramienta } from "ai";
export type { ToolSet as Herramientas } from "ai";
export { leerConfigIA, type ConfigIA } from "@/lib/ai/config";

/** Un turno de la conversación tal como lo maneja la aplicación. */
export type MensajeChat = {
  rol: "usuario" | "asistente";
  contenido: string;
};

export type PeticionAsistente = {
  /** Instrucciones del sistema: quién es el asistente y qué no puede hacer. */
  sistema: string;
  mensajes: readonly MensajeChat[];
  herramientas: ToolSet;
  /**
   * Para pruebas: un modelo ya construido y su configuración. En producción se
   * omiten y se leen de las variables de entorno.
   */
  modelo?: LanguageModel;
  config?: ConfigIA;
};

export type RespuestaModelo = {
  texto: string;
  /** Cuántas herramientas llamó el modelo para responder. */
  consultas: number;
};

/** Los últimos `maximo` mensajes: lo que cabe en el contexto configurado. */
export function recortarContexto<T>(
  mensajes: readonly T[],
  maximo: number,
): T[] {
  return mensajes.slice(Math.max(0, mensajes.length - maximo));
}

function aMensajesDelModelo(mensajes: readonly MensajeChat[]): ModelMessage[] {
  return mensajes.map((mensaje) => ({
    role: mensaje.rol === "usuario" ? "user" : "assistant",
    content: mensaje.contenido,
  }));
}

/**
 * Le hace una pregunta al modelo dándole herramientas de solo lectura. El
 * modelo decide cuáles llamar (hasta `maxPasosHerramientas` rondas) y redacta
 * la respuesta final con lo que obtuvo.
 *
 * Lanza si la configuración falta o si el proveedor falla: quien llama decide
 * el mensaje para la persona.
 */
export async function responderConHerramientas(
  peticion: PeticionAsistente,
): Promise<RespuestaModelo> {
  const config = peticion.config ?? exigirConfig();
  const modelo = peticion.modelo ?? crearModelo(config);

  const resultado = await generateText({
    model: modelo,
    system: peticion.sistema,
    messages: aMensajesDelModelo(
      recortarContexto(peticion.mensajes, config.maxMensajesContexto),
    ),
    tools: peticion.herramientas,
    // Una ronda más que las consultas permitidas, para que la última sea la
    // respuesta en texto y no se quede a medias tras la última herramienta.
    stopWhen: stepCountIs(config.maxPasosHerramientas + 1),
    maxOutputTokens: config.maxTokensRespuesta,
    temperature: config.temperatura,
    timeout: { totalMs: config.tiempoMaximoMs },
  });

  return {
    texto: resultado.text.trim(),
    consultas: resultado.steps.reduce(
      (total, paso) => total + paso.toolCalls.length,
      0,
    ),
  };
}

function exigirConfig(): ConfigIA {
  const resultado = leerConfigIA();
  if (!resultado.ok) throw new Error(resultado.motivo);
  return resultado.config;
}
