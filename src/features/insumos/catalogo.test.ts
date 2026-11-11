import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  esTipoInsumo,
  etiquetaDeInsumo,
  INSUMOS,
} from "@/features/insumos/catalogo";
import { Constants } from "@/types/database.types";

/**
 * HU-23 · El catálogo de insumos vive en dos lados: `catalogo.ts` y el enum
 * `tipo_insumo` de la base. Si alguien cambia uno solo, esto se pone rojo.
 */

const MIGRACIONES = join(process.cwd(), "supabase", "migrations");

function valoresDelEnumEnSql(): string[] {
  const sql = readdirSync(MIGRACIONES)
    .filter((nombre) => nombre.endsWith(".sql"))
    .sort()
    .map((nombre) => readFileSync(join(MIGRACIONES, nombre), "utf8"))
    .join("\n");

  const cuerpo = sql.match(
    /create type public\.tipo_insumo as enum \(([^)]*)\)/i,
  );
  if (!cuerpo) throw new Error("Ninguna migración crea `tipo_insumo`");

  return [...cuerpo[1].matchAll(/'([^']+)'/g)].map((valor) => valor[1]);
}

describe("catálogo de insumos", () => {
  it("trae los siete insumos de la historia, en el orden del taller", () => {
    expect(INSUMOS.map((insumo) => insumo.etiqueta)).toEqual([
      "Hilo",
      "Resorte",
      "Cierre",
      "Botón",
      "Hilo de bordar",
      "Sublimado",
      "Estampado",
    ]);
  });

  it("dice lo mismo que el enum de la migración", () => {
    expect(INSUMOS.map((insumo) => insumo.id)).toEqual(valoresDelEnumEnSql());
  });

  it("dice lo mismo que los tipos generados de la base", () => {
    expect(INSUMOS.map((insumo) => insumo.id)).toEqual([
      ...Constants.public.Enums.tipo_insumo,
    ]);
  });

  it("cada insumo trae un ejemplo de qué escribir", () => {
    for (const insumo of INSUMOS) {
      expect(insumo.ejemplo.trim().length).toBeGreaterThan(0);
    }
  });

  it("reconoce los insumos del catálogo y nada más", () => {
    expect(esTipoInsumo("boton")).toBe(true);
    expect(esTipoInsumo("hilo_bordar")).toBe(true);
    expect(esTipoInsumo("tela")).toBe(false);
    expect(esTipoInsumo("")).toBe(false);
  });

  it("pinta la etiqueta de cada insumo", () => {
    expect(etiquetaDeInsumo("hilo_bordar")).toBe("Hilo de bordar");
    expect(etiquetaDeInsumo("boton")).toBe("Botón");
  });
});
