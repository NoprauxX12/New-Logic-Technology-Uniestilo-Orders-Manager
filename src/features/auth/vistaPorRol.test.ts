import { describe, expect, it } from "vitest";

import {
  buscarCheckpoint,
  ETIQUETAS_ROL,
  type Rol,
} from "@/features/workflow/checkpoints";
import { vistaDeRol } from "@/features/auth/vistaPorRol";

/**
 * A dónde manda el botón de cada rol al entrar (HU-16).
 *
 * No se prueba el contenido exacto de cada etiqueta —eso cambia con el
 * producto—, sino el invariante que sostiene la pantalla: todo rol tiene algo
 * que hacer al entrar, y las rutas son internas.
 */

const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

describe("vistaDeRol · cobertura", () => {
  it("le da una vista a los seis roles del modelo", () => {
    for (const rol of ROLES) {
      expect(() => vistaDeRol(rol)).not.toThrow();
    }
  });

  it("todo rol tiene a dónde ir, o un aviso de por qué todavía no", () => {
    for (const rol of ROLES) {
      const vista = vistaDeRol(rol);
      expect(vista.botones.length > 0 || vista.aviso !== null).toBe(true);
    }
  });

  it("las rutas de los botones son internas, no enlaces sueltos", () => {
    for (const rol of ROLES) {
      for (const boton of vistaDeRol(rol).botones) {
        expect(boton.ruta.startsWith("/")).toBe(true);
      }
    }
  });
});

describe("vistaDeRol · roles con pantalla propia", () => {
  it("no llevan aviso: su historia ya está construida", () => {
    for (const rol of [
      "admin",
      "secretaria",
      "diseno",
      "corte",
      "logistica",
      "marcacion",
    ] as const) {
      expect(vistaDeRol(rol).aviso).toBeNull();
    }
  });

  it("diseño va a adjuntar la ficha técnica, con la etiqueta de checkpoints.ts", () => {
    const vista = vistaDeRol("diseno");
    const ruta = buscarCheckpoint("ficha_adjunta").ruta;

    expect(ruta).not.toBeNull();
    expect(vista.botones[0].ruta).toBe(ruta);
    expect(vista.botones[0].etiqueta).toMatch(/adjuntar ficha técnica/i);
  });

  it("logística marca el recogido y bordado y después despacha y recibe lotes", () => {
    const vista = vistaDeRol("logistica");

    expect(vista.botones.map((boton) => boton.ruta)).toEqual([
      "/ordenes/recogido-bordado",
      "/ordenes/talleres",
    ]);
  });

  it("corte va a marcar su etapa, con la etiqueta de checkpoints.ts", () => {
    const vista = vistaDeRol("corte");

    expect(vista.botones[0].ruta).toBe("/ordenes/corte");
    expect(vista.botones[0].etiqueta).toMatch(/corte completado/i);
  });

  it("marcación va a marcar su etapa, con la etiqueta de checkpoints.ts", () => {
    const vista = vistaDeRol("marcacion");

    expect(vista.botones[0].ruta).toBe("/ordenes/marcacion");
    expect(vista.botones[0].etiqueta).toMatch(/llegada a marcación/i);
  });

  it("terminación marca la salida a despacho (HU-19), en su propia pantalla", () => {
    const vista = vistaDeRol("terminacion");
    const ruta = buscarCheckpoint("lista_despacho").ruta;

    expect(ruta).not.toBeNull();
    expect(vista.botones.map((b) => b.ruta)).toEqual([ruta]);
    expect(vista.botones[0].etiqueta).toMatch(/lista para despachar/i);
  });

  it("marcación ya no marca la salida a despacho: solo su llegada", () => {
    const rutas = vistaDeRol("marcacion").botones.map((b) => b.ruta);

    expect(rutas).toEqual(["/ordenes/marcacion"]);
  });

  it("secretaría empieza por las cotizaciones (HU-02), antes de programar a diseño", () => {
    const rutas = vistaDeRol("secretaria").botones.map((b) => b.ruta);

    expect(rutas[0]).toBe(buscarCheckpoint("cotizacion_enviada").ruta);
    expect(rutas[0]).toBe("/ordenes/cotizacion");
    expect(rutas[1]).toBe("/ordenes/programacion");
  });

  it("secretaría programa a diseño y cierra órdenes, sus dos pantallas", () => {
    const rutas = vistaDeRol("secretaria").botones.map((b) => b.ruta);

    expect(rutas).toContain("/ordenes/programacion");
    expect(rutas).toContain("/ordenes/cierre");
  });

  it("secretaría también valida telas y avisa cuando falta (HU-06)", () => {
    const rutas = vistaDeRol("secretaria").botones.map((b) => b.ruta);

    expect(rutas).toContain("/ordenes/telas");
  });

  it("admin puede ver el tablero, registrar órdenes y crear cuentas", () => {
    const rutas = vistaDeRol("admin").botones.map((b) => b.ruta);

    expect(rutas).toContain("/tablero");
    expect(rutas).toContain("/ordenes/nueva");
    expect(rutas).toContain("/usuarios");
  });
});
