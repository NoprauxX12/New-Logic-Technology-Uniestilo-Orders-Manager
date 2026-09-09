import { describe, expect, it } from "vitest";
import { z } from "zod";

import { despacharLoteSchema } from "@/features/talleres/schemas";

const ORDEN_ID = "00000000-0000-0000-0000-0000000000f3";
const LOGISTICA_ID = "00000000-0000-0000-0000-0000000000a5";

const DESPACHO_VALIDO = {
  ordenId: ORDEN_ID,
  taller: "Taller Marinilla Centro",
  descripcionPrendas: "250 polos verdes talla S y M",
  enviadoPor: LOGISTICA_ID,
};

type ErroresPorCampo = Record<string, string[] | undefined>;

function erroresDe(entrada: unknown): ErroresPorCampo {
  const resultado = despacharLoteSchema.safeParse(entrada);
  if (resultado.success) return {};
  return z.flattenError(resultado.error).fieldErrors as ErroresPorCampo;
}

describe("despacharLoteSchema", () => {
  it("acepta un despacho completo", () => {
    expect(despacharLoteSchema.safeParse(DESPACHO_VALIDO).success).toBe(true);
  });

  it("no deja despachar sin taller", () => {
    const errores = erroresDe({ ...DESPACHO_VALIDO, taller: "" });

    expect(errores.taller).toContain("Escribe a qué taller se envió el lote");
  });

  it("tampoco deja despachar con un taller de puros espacios", () => {
    const errores = erroresDe({ ...DESPACHO_VALIDO, taller: "    " });

    expect(errores.taller).toContain("Escribe a qué taller se envió el lote");
  });

  it("quita los espacios sobrantes de lo que se escribió", () => {
    const resultado = despacharLoteSchema.safeParse({
      ...DESPACHO_VALIDO,
      taller: "  Taller Marinilla Centro  ",
    });

    expect(resultado.success && resultado.data.taller).toBe(
      "Taller Marinilla Centro",
    );
  });

  it("pide la descripción de las prendas", () => {
    const errores = erroresDe({ ...DESPACHO_VALIDO, descripcionPrendas: "" });

    expect(errores.descripcionPrendas).toContain(
      "Escribe qué prendas se enviaron",
    );
  });

  it("pide escoger quién hace el despacho", () => {
    const errores = erroresDe({ ...DESPACHO_VALIDO, enviadoPor: "" });

    expect(errores.enviadoPor).toContain("Escoge quién hace el despacho");
  });

  it("rechaza una orden que no es un identificador válido", () => {
    const errores = erroresDe({ ...DESPACHO_VALIDO, ordenId: "la-primera" });

    expect(errores.ordenId).toContain(
      "No se sabe a qué orden pertenece este despacho",
    );
  });
});
