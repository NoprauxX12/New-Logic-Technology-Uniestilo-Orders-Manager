import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ConfigIA } from "@/lib/ai/config";
import {
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

describe("recortarContexto", () => {
  it("se queda con los últimos mensajes", () => {
    expect(recortarContexto([1, 2, 3, 4], 2)).toEqual([3, 4]);
  });

  it("no toca una conversación que cabe", () => {
    expect(recortarContexto([1, 2], 5)).toEqual([1, 2]);
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
});
