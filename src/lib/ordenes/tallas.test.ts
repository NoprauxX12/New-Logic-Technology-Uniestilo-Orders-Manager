import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  armarTextoTallas,
  esTallaje,
  IDS_DE_TALLAJE,
  sumarTallas,
  TALLAJE_OTRO,
  TALLAJES,
  TALLAJES_VALIDOS,
} from "@/lib/ordenes/tallas";

/**
 * Los tallajes son datos del negocio (los estándares que maneja Uniestilo) y el
 * texto que se guarda sale de aquí, así que se prueba que no se desvíen.
 */

describe("TALLAJES", () => {
  it("tiene los cuatro tallajes de Uniestilo", () => {
    expect(IDS_DE_TALLAJE).toEqual([
      "superior_hombre",
      "inferior_hombre",
      "superior_dama",
      "inferior_dama",
    ]);
  });

  it("superior hombre va de XXS a 6XL", () => {
    const { tallas } = TALLAJES.superior_hombre;

    expect(tallas[0]).toBe("XXS");
    expect(tallas.at(-1)).toBe("6XL");
    expect(tallas).toHaveLength(11);
  });

  it("inferior hombre va de la 28 a la 50 de dos en dos", () => {
    const { tallas } = TALLAJES.inferior_hombre;

    expect(tallas[0]).toBe("28");
    expect(tallas.at(-1)).toBe("50");
    expect(tallas).toHaveLength(12);
  });

  it("superior e inferior de dama van de la 2 a la 24", () => {
    for (const id of ["superior_dama", "inferior_dama"] as const) {
      const { tallas } = TALLAJES[id];
      expect(tallas[0]).toBe("2");
      expect(tallas.at(-1)).toBe("24");
      expect(tallas).toHaveLength(12);
    }
  });

  it("ninguna talla se repite dentro de su tallaje", () => {
    for (const id of IDS_DE_TALLAJE) {
      const { tallas } = TALLAJES[id];
      expect(new Set(tallas).size).toBe(tallas.length);
    }
  });

  it("ninguna talla trae ':' ni ',', que son los separadores del texto guardado", () => {
    for (const id of IDS_DE_TALLAJE) {
      for (const talla of TALLAJES[id].tallas) {
        expect(talla).not.toMatch(/[:,]/);
      }
    }
  });

  it("los identificadores son los mismos que acepta el check de la base", () => {
    const migracion = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261018123000_tallaje_en_items.sql",
      ),
      "utf8",
    );
    const enLaBase = [...migracion.matchAll(/^\s+'([a-z_]+)',?$/gm)].map(
      (coincidencia) => coincidencia[1],
    );

    expect([...enLaBase].sort()).toEqual([...TALLAJES_VALIDOS].sort());
  });
});

describe("esTallaje", () => {
  it("reconoce los del catálogo y no 'otro' ni basura", () => {
    expect(esTallaje("superior_dama")).toBe(true);
    expect(esTallaje(TALLAJE_OTRO)).toBe(false);
    expect(esTallaje("")).toBe(false);
    expect(esTallaje("toString")).toBe(false);
  });
});

describe("sumarTallas", () => {
  it("suma las cantidades de todas las tallas", () => {
    expect(sumarTallas({ S: 20, M: 40, L: 30 })).toBe(90);
  });

  it("suma cero si no hay nada", () => {
    expect(sumarTallas({})).toBe(0);
  });
});

describe("armarTextoTallas", () => {
  it("escribe el mismo formato que se escribía a mano", () => {
    expect(armarTextoTallas("superior_hombre", { S: 20, M: 40, L: 30 })).toBe(
      "S:20, M:40, L:30",
    );
  });

  it("sale en el orden del tallaje, no en el que se llenó", () => {
    expect(armarTextoTallas("superior_hombre", { XL: 5, XS: 10, M: 3 })).toBe(
      "XS:10, M:3, XL:5",
    );
  });

  it("deja por fuera las tallas sin prendas", () => {
    expect(armarTextoTallas("inferior_hombre", { 28: 0, 30: 12, 32: 0 })).toBe(
      "30:12",
    );
  });

  it("ignora tallas que no son del tallaje", () => {
    expect(armarTextoTallas("superior_dama", { S: 9, 8: 4 })).toBe("8:4");
  });
});
