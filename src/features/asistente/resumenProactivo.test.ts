import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Pendientes } from "@/lib/ordenes/pendientes";
import type { OrdenEnTablero } from "@/lib/ordenes/types";

/**
 * HU-21 · La action del resumen proactivo. Se sustituyen la sesión, la lectura
 * de la base y el modelo; aquí se prueba qué decide: a quién le responde,
 * cuándo le pregunta al modelo y que, si el modelo no está o falla, el resumen
 * sale igual sin IA.
 */

const getUsuarioActual = vi.hoisted(() => vi.fn());
const leerPendientes = vi.hoisted(() => vi.fn());
const leerConfigIA = vi.hoisted(() => vi.fn());
const responderConHerramientas = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/usuarioActual", () => ({ getUsuarioActual }));
vi.mock("@/features/asistente/queries", () => ({ leerPendientes }));
vi.mock("@/features/asistente/herramientas", () => ({
  crearHerramientas: () => ({}),
}));
vi.mock("@/lib/ai", () => {
  class FalloDelModelo extends Error {
    readonly tipo: string;
    constructor(tipo: string) {
      super(tipo);
      this.tipo = tipo;
    }
  }
  return { FalloDelModelo, leerConfigIA, responderConHerramientas };
});

const { resumenProactivo } = await import("@/features/asistente/actions");
const { FalloDelModelo } = await import("@/lib/ai");

const ADMIN = { id: "u1", nombre: "Néstor", rol: "admin" };

const VACIO: Pendientes = {
  atrasadas: [],
  enRiesgo: [],
  detenidas: [],
  alertasDeTela: [],
  avisosDeEntrega: [],
};

const ATRASADA = {
  orden: {
    id: "00000000-0000-0000-0000-0000000000f5",
    numeroOrdenCompra: "OC-5005",
    razonSocial: "Clínica del Norte",
    prenda: "Uniforme",
    cantidad: 80,
    fechaEntrega: "2026-10-01",
  } as OrdenEnTablero,
  diasSinAvance: 2,
  parada: { area: "Corte", siguiente: "Corte completado", enTaller: false },
};

const CONFIG = { ok: true, config: { modelo: "de-prueba" } };

describe("resumenProactivo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsuarioActual.mockResolvedValue(ADMIN);
    leerPendientes.mockResolvedValue({ ...VACIO, atrasadas: [ATRASADA] });
    leerConfigIA.mockReturnValue(CONFIG);
  });

  it("solo responde a administración", async () => {
    getUsuarioActual.mockResolvedValue({ ...ADMIN, rol: "corte" });

    expect(await resumenProactivo()).toEqual({
      ok: false,
      mensaje: "El asistente es solo para administración.",
    });
    expect(leerPendientes).not.toHaveBeenCalled();
  });

  it("le pasa los pendientes al modelo, sin herramientas, y devuelve lo que redacta", async () => {
    responderConHerramientas.mockResolvedValue({
      texto: "Hoy tienes 1 orden atrasada.",
      consultas: 0,
    });

    expect(await resumenProactivo()).toEqual({
      ok: true,
      texto: "Hoy tienes 1 orden atrasada.",
    });

    const [peticion] = responderConHerramientas.mock.calls[0];
    expect(peticion.herramientas).toEqual({});
    expect(peticion.mensajes).toHaveLength(1);
    expect(peticion.mensajes[0].contenido).toContain("OC-5005");
    expect(peticion.mensajes[0].contenido).toContain("Podrías");
    expect(peticion.sistema).toMatch(/nunca decidas por la persona/);
  });

  it("si no hay nada pendiente no le pregunta al modelo", async () => {
    leerPendientes.mockResolvedValue(VACIO);

    const respuesta = await resumenProactivo();

    expect(respuesta).toMatchObject({ ok: true });
    expect(respuesta.ok && respuesta.texto).toMatch(/no hay atrasadas/);
    expect(responderConHerramientas).not.toHaveBeenCalled();
  });

  it("sin el modelo configurado devuelve el resumen sin IA", async () => {
    leerConfigIA.mockReturnValue({ ok: false, motivo: "Falta IA_API_KEY" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const respuesta = await resumenProactivo();

    expect(respuesta.ok && respuesta.texto).toContain("**Atrasadas (1)**");
    expect(respuesta.ok && respuesta.texto).toContain(
      "[Consúltala aquí](/tablero/00000000-0000-0000-0000-0000000000f5)",
    );
    expect(responderConHerramientas).not.toHaveBeenCalled();
  });

  it("si el modelo falla devuelve el resumen sin IA", async () => {
    responderConHerramientas.mockRejectedValue(
      new FalloDelModelo("ocupado", null),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const respuesta = await resumenProactivo();

    expect(respuesta.ok && respuesta.texto).toContain("**Atrasadas (1)**");
  });

  it("si el modelo responde en blanco devuelve el resumen sin IA", async () => {
    responderConHerramientas.mockResolvedValue({ texto: "", consultas: 0 });

    const respuesta = await resumenProactivo();

    expect(respuesta.ok && respuesta.texto).toContain("**Atrasadas (1)**");
  });

  it("si no puede leer la base lo dice sin tumbar el panel", async () => {
    leerPendientes.mockRejectedValue(new Error("caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await resumenProactivo()).toEqual({
      ok: false,
      mensaje: expect.stringMatching(/no pude revisar lo pendiente/i),
    });
  });
});
