import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ConfigIA } from "@/lib/ai/config";
import {
  FalloDelModelo,
  herramienta,
  recortarContexto,
  responderConHerramientas,
} from "@/lib/ai/index";

/**
 * HU-15 · La capa sobre el LLM: que ejecute las herramientas que el modelo
 * pide, que recorte el contexto y que devuelva el texto final. El modelo es un
 * doble, así que no hay red ni llave.
 *
 * `server-only` se sustituye porque el módulo lo importa para que la llave no
 * llegue nunca al navegador; aquí corre en Node y no hay nada que proteger.
 */
vi.mock("server-only", () => ({}));

const CONFIG: ConfigIA = {
  proveedor: "groq",
  apiKey: "gsk_prueba",
  modelo: "prueba",
  maxMensajesContexto: 2,
  maxCaracteresContexto: 1000,
  maxTokensRespuesta: 100,
  temperatura: 0,
  maxPasosHerramientas: 2,
  tiempoMaximoMs: 5000,
};

const USO = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function respuestaTexto(texto: string) {
  return {
    content: [{ type: "text" as const, text: texto }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage: USO,
    warnings: [],
  };
}

function respuestaHerramienta(nombre: string, input: object) {
  return {
    content: [
      {
        type: "tool-call" as const,
        toolCallId: "llamada-1",
        toolName: nombre,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage: USO,
    warnings: [],
  };
}

function m(contenido: string) {
  return { contenido };
}

describe("recortarContexto", () => {
  it("se queda con los últimos mensajes", () => {
    expect(
      recortarContexto([m("1"), m("2"), m("3"), m("4")], {
        maxMensajes: 2,
        maxCaracteres: 1000,
      }),
    ).toEqual([m("3"), m("4")]);
  });

  it("no toca una conversación que cabe", () => {
    expect(
      recortarContexto([m("1"), m("2")], {
        maxMensajes: 5,
        maxCaracteres: 1000,
      }),
    ).toEqual([m("1"), m("2")]);
  });

  it("corta por caracteres aunque quepan más mensajes", () => {
    const mensajes = [
      m("a".repeat(500)),
      m("b".repeat(300)),
      m("c".repeat(300)),
    ];

    expect(
      recortarContexto(mensajes, { maxMensajes: 10, maxCaracteres: 650 }),
    ).toEqual([m("b".repeat(300)), m("c".repeat(300))]);
  });

  it("siempre manda la pregunta actual aunque se pase del presupuesto", () => {
    const mensajes = [m("corto"), m("x".repeat(900))];

    expect(
      recortarContexto(mensajes, { maxMensajes: 10, maxCaracteres: 100 }),
    ).toEqual([m("x".repeat(900))]);
  });
});

describe("responderConHerramientas", () => {
  it("ejecuta la herramienta que el modelo pide y devuelve el texto final", async () => {
    const estadoDeOrden = vi.fn(async ({ ordenId }: { ordenId: string }) => ({
      ordenId,
      etapaActual: "Corte completado",
    }));
    const respuestas = [
      respuestaHerramienta("estadoDeOrden", { ordenId: "f3" }),
      respuestaTexto("La orden OC-5003 va en corte completado."),
    ];
    const modelo = new MockLanguageModelV4({
      doGenerate: async () => respuestas.shift()!,
    });

    const resultado = await responderConHerramientas({
      sistema: "Eres el asistente.",
      mensajes: [{ rol: "usuario", contenido: "¿En qué va la OC-5003?" }],
      herramientas: {
        estadoDeOrden: herramienta({
          description: "Estado de una orden",
          inputSchema: z.object({ ordenId: z.string() }),
          execute: estadoDeOrden,
        }),
      },
      modelo,
      config: CONFIG,
    });

    expect(estadoDeOrden).toHaveBeenCalledWith(
      { ordenId: "f3" },
      expect.anything(),
    );
    expect(resultado).toEqual({
      texto: "La orden OC-5003 va en corte completado.",
      consultas: 1,
    });
  });

  it("manda al modelo solo los últimos mensajes del contexto configurado", async () => {
    const modelo = new MockLanguageModelV4({
      doGenerate: async () => respuestaTexto("Listo."),
    });

    await responderConHerramientas({
      sistema: "Sistema",
      mensajes: [
        { rol: "usuario", contenido: "uno" },
        { rol: "asistente", contenido: "dos" },
        { rol: "usuario", contenido: "tres" },
      ],
      herramientas: {},
      modelo,
      config: CONFIG,
    });

    const prompt = modelo.doGenerateCalls[0].prompt;
    const sinSistema = prompt.filter((m) => m.role !== "system");
    expect(prompt[0]).toMatchObject({ role: "system", content: "Sistema" });
    expect(sinSistema.map((m) => m.role)).toEqual(["assistant", "user"]);
  });

  it("aplica los límites de la configuración al modelo", async () => {
    const modelo = new MockLanguageModelV4({
      doGenerate: async () => respuestaTexto("Listo."),
    });

    await responderConHerramientas({
      sistema: "Sistema",
      mensajes: [{ rol: "usuario", contenido: "hola" }],
      herramientas: {},
      modelo,
      config: CONFIG,
    });

    expect(modelo.doGenerateCalls[0]).toMatchObject({
      maxOutputTokens: 100,
      temperature: 0,
    });
  });

  it("clasifica el límite por minuto del proveedor como 'ocupado'", async () => {
    const modelo = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new APICallError({
          message: "Rate limit reached",
          url: "https://api.groq.com/openai/v1/chat/completions",
          requestBodyValues: {},
          statusCode: 429,
          isRetryable: true,
        });
      },
    });

    const intento = responderConHerramientas({
      sistema: "Sistema",
      mensajes: [{ rol: "usuario", contenido: "hola" }],
      herramientas: {},
      modelo,
      config: CONFIG,
    });

    await expect(intento).rejects.toBeInstanceOf(FalloDelModelo);
    await expect(intento).rejects.toMatchObject({ tipo: "ocupado" });
  });

  it("clasifica una espera abortada como 'tiempo'", async () => {
    const modelo = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new DOMException("Delay was aborted", "AbortError");
      },
    });

    await expect(
      responderConHerramientas({
        sistema: "Sistema",
        mensajes: [{ rol: "usuario", contenido: "hola" }],
        herramientas: {},
        modelo,
        config: CONFIG,
      }),
    ).rejects.toMatchObject({ tipo: "tiempo" });
  });

  it("cualquier otro fallo es del proveedor", async () => {
    const modelo = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("se cayó");
      },
    });

    await expect(
      responderConHerramientas({
        sistema: "Sistema",
        mensajes: [{ rol: "usuario", contenido: "hola" }],
        herramientas: {},
        modelo,
        config: CONFIG,
      }),
    ).rejects.toMatchObject({ tipo: "proveedor" });
  });
});
