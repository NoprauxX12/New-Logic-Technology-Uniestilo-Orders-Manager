import "server-only";

import {
  APICallError,
  generateText,
  RetryError,
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

/**
 * Por qué no hubo respuesta, ya clasificado para que quien llama elija el
 * mensaje: `ocupado` es el límite por minuto del proveedor (HTTP 429),
 * `tiempo` es que se pasó de `IA_TIEMPO_MAXIMO_MS`, y `proveedor` todo lo
 * demás (llave inválida, caída, red).
 */
export type TipoFalloModelo = "ocupado" | "tiempo" | "proveedor";

export class FalloDelModelo extends Error {
  readonly tipo: TipoFalloModelo;

  constructor(tipo: TipoFalloModelo, causa: unknown) {
    super(`El modelo no respondió (${tipo})`, { cause: causa });
    this.name = "FalloDelModelo";
    this.tipo = tipo;
  }
}

export type LimitesContexto = {
  maxMensajes: number;
  maxCaracteres: number;
};

/**
 * Los últimos mensajes que caben en el contexto: como mucho `maxMensajes` y
 * como mucho `maxCaracteres` sumados. La pregunta actual (el último) va
 * siempre, aunque ella sola se pase del presupuesto.
 */
export function recortarContexto<T extends { contenido: string }>(
  mensajes: readonly T[],
  limites: LimitesContexto,
): T[] {
  const resultado: T[] = [];
  let caracteres = 0;

  for (let indice = mensajes.length - 1; indice >= 0; indice -= 1) {
    const mensaje = mensajes[indice];
    const cabe =
      resultado.length < limites.maxMensajes &&
      caracteres + mensaje.contenido.length <= limites.maxCaracteres;

    if (!cabe && resultado.length > 0) break;

    resultado.unshift(mensaje);
    caracteres += mensaje.contenido.length;
  }

  return resultado;
}

function aMensajesDelModelo(mensajes: readonly MensajeChat[]): ModelMessage[] {
  return mensajes.map((mensaje) => ({
    role: mensaje.rol === "usuario" ? "user" : "assistant",
    content: mensaje.contenido,
  }));
}

function nombreDe(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const nombre = (error as { name?: unknown }).name;
  return typeof nombre === "string" ? nombre : null;
}

function clasificarFallo(error: unknown): TipoFalloModelo {
  const errores = RetryError.isInstance(error)
    ? [error, ...error.errors]
    : [error];

  if (
    errores.some(
      (candidato) =>
        APICallError.isInstance(candidato) && candidato.statusCode === 429,
    )
  ) {
    return "ocupado";
  }

  if (
    errores.some((candidato) =>
      ["AbortError", "TimeoutError"].includes(nombreDe(candidato) ?? ""),
    )
  ) {
    return "tiempo";
  }

  return "proveedor";
}

/**
 * Le hace una pregunta al modelo dándole herramientas de solo lectura. El
 * modelo decide cuáles llamar (hasta `maxPasosHerramientas` rondas) y redacta
 * la respuesta final con lo que obtuvo.
 *
 * Lanza `Error` si la configuración falta y `FalloDelModelo` si el proveedor
 * no respondió. No reintenta por su cuenta: el proveedor pide esperar más de
 * lo que dura `IA_TIEMPO_MAXIMO_MS` cuando limita por minuto, y un reintento
 * solo convertiría un "ocupado" claro en un "tardó demasiado" confuso. La
 * persona vuelve a preguntar.
 */
export async function responderConHerramientas(
  peticion: PeticionAsistente,
): Promise<RespuestaModelo> {
  const config = peticion.config ?? exigirConfig();
  const modelo = peticion.modelo ?? crearModelo(config);

  try {
    const resultado = await generateText({
      model: modelo,
      system: peticion.sistema,
      messages: aMensajesDelModelo(
        recortarContexto(peticion.mensajes, {
          maxMensajes: config.maxMensajesContexto,
          maxCaracteres: config.maxCaracteresContexto,
        }),
      ),
      tools: peticion.herramientas,
      // Una ronda más que las consultas permitidas, para que la última sea la
      // respuesta en texto y no se quede a medias tras la última herramienta.
      stopWhen: stepCountIs(config.maxPasosHerramientas + 1),
      maxOutputTokens: config.maxTokensRespuesta,
      temperature: config.temperatura,
      timeout: { totalMs: config.tiempoMaximoMs },
      maxRetries: 0,
    });

    return {
      texto: resultado.text.trim(),
      consultas: resultado.steps.reduce(
        (total, paso) => total + paso.toolCalls.length,
        0,
      ),
    };
  } catch (error) {
    throw new FalloDelModelo(clasificarFallo(error), error);
  }
}

function exigirConfig(): ConfigIA {
  const resultado = leerConfigIA();
  if (!resultado.ok) throw new Error(resultado.motivo);
  return resultado.config;
}
