import { describe, expect, it } from "vitest";

import { leerConfigIA } from "@/lib/ai/config";

/**
 * HU-15 · La configuración del asistente sale de las variables de entorno y se
 * valida al usarla, no al cargar el módulo: el build no debe exigir la llave.
 */

const COMPLETA = {
  IA_PROVEEDOR: "groq",
  IA_API_KEY: "gsk_prueba",
  IA_MODELO: "llama-3.3-70b-versatile",
  IA_MAX_MENSAJES_CONTEXTO: "10",
  IA_MAX_TOKENS_RESPUESTA: "300",
  IA_TEMPERATURA: "0.1",
  IA_MAX_PASOS_HERRAMIENTAS: "3",
  IA_TIEMPO_MAXIMO_MS: "15000",
};

describe("leerConfigIA", () => {
  it("lee y convierte todas las variables", () => {
    const resultado = leerConfigIA(COMPLETA);

    expect(resultado).toEqual({
      ok: true,
      config: {
        proveedor: "groq",
        apiKey: "gsk_prueba",
        modelo: "llama-3.3-70b-versatile",
        maxMensajesContexto: 10,
        maxTokensRespuesta: 300,
        temperatura: 0.1,
        maxPasosHerramientas: 3,
        tiempoMaximoMs: 15000,
      },
    });
  });

  it("solo exige la llave; lo demás tiene valor por defecto", () => {
    const resultado = leerConfigIA({ IA_API_KEY: "gsk_prueba" });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.config.proveedor).toBe("groq");
    expect(resultado.config.modelo).toBe("llama-3.3-70b-versatile");
    expect(resultado.config.maxMensajesContexto).toBe(20);
    expect(resultado.config.maxTokensRespuesta).toBe(600);
    expect(resultado.config.temperatura).toBe(0.2);
    expect(resultado.config.maxPasosHerramientas).toBe(4);
    expect(resultado.config.tiempoMaximoMs).toBe(20000);
  });

  it("sin llave dice que el asistente no está configurado", () => {
    const resultado = leerConfigIA({});

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toMatch(/IA_API_KEY/);
  });

  it("rechaza una llave vacía", () => {
    expect(leerConfigIA({ IA_API_KEY: "   " }).ok).toBe(false);
  });

  it("rechaza un proveedor que no existe", () => {
    const resultado = leerConfigIA({
      IA_API_KEY: "gsk_prueba",
      IA_PROVEEDOR: "openai",
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.motivo).toMatch(/IA_PROVEEDOR/);
  });

  it("rechaza números fuera de rango o que no son números", () => {
    expect(
      leerConfigIA({ IA_API_KEY: "k", IA_MAX_MENSAJES_CONTEXTO: "0" }).ok,
    ).toBe(false);
    expect(leerConfigIA({ IA_API_KEY: "k", IA_TEMPERATURA: "3" }).ok).toBe(
      false,
    );
    expect(
      leerConfigIA({ IA_API_KEY: "k", IA_TIEMPO_MAXIMO_MS: "rápido" }).ok,
    ).toBe(false);
  });
});
