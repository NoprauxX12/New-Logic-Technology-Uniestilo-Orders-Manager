import { describe, expect, it } from "vitest";

import { ETIQUETAS_ROL, type Rol } from "@/features/workflow/checkpoints";
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

  it("todo rol tiene al menos un botón a dónde ir", () => {
    for (const rol of ROLES) {
      expect(vistaDeRol(rol).botones.length).toBeGreaterThan(0);
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

describe("vistaDeRol · roles sin pantalla propia", () => {
  it("diseño ve el tablero mientras HU-04 no exista, con un aviso", () => {
    const vista = vistaDeRol("diseno");

    expect(vista.aviso).not.toBeNull();
    expect(vista.botones.map((b) => b.ruta)).toContain("/tablero");
  });

  it("logística ve el tablero mientras HU-09/HU-11 no existan, con un aviso", () => {
    const vista = vistaDeRol("logistica");

    expect(vista.aviso).not.toBeNull();
    expect(vista.botones.map((b) => b.ruta)).toContain("/tablero");
  });
});

describe("vistaDeRol · roles con pantalla propia", () => {
  it("no llevan aviso: su historia ya está construida", () => {
    for (const rol of ["admin", "secretaria", "corte", "marcacion"] as const) {
      expect(vistaDeRol(rol).aviso).toBeNull();
    }
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

  it("secretaría va al cierre", () => {
    const vista = vistaDeRol("secretaria");

    expect(vista.botones[0].ruta).toBe("/ordenes/cierre");
  });

  it("admin puede registrar y ver el tablero, sus dos responsabilidades", () => {
    const rutas = vistaDeRol("admin").botones.map((b) => b.ruta);

    expect(rutas).toContain("/tablero");
    expect(rutas).toContain("/ordenes/nueva");
  });
});
