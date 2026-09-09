import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  cierreSchema,
  facturaSchema,
  reporteSimpleSchema,
} from "@/features/documentos/schemas";

const ORDEN_ID = "00000000-0000-0000-0000-0000000000f6";
const SECRETARIA_ID = "00000000-0000-0000-0000-0000000000a2";

type ErroresPorCampo = Record<string, string[] | undefined>;

function erroresDe(schema: z.ZodType, entrada: unknown): ErroresPorCampo {
  const resultado = schema.safeParse(entrada);
  if (resultado.success) return {};
  return z.flattenError(resultado.error).fieldErrors as ErroresPorCampo;
}

describe("reporteSimpleSchema", () => {
  it("acepta los dos reportes que solo se marcan", () => {
    for (const reporte of ["etiquetas", "documentos_despacho"]) {
      const resultado = reporteSimpleSchema.safeParse({
        ordenId: ORDEN_ID,
        usuarioId: SECRETARIA_ID,
        reporte,
      });

      expect(resultado.success).toBe(true);
    }
  });

  it("rechaza cualquier otra etapa", () => {
    const errores = erroresDe(reporteSimpleSchema, {
      ordenId: ORDEN_ID,
      usuarioId: SECRETARIA_ID,
      reporte: "cerrada",
    });

    expect(errores.reporte).toContain("Ese reporte no existe");
  });

  it("acepta los identificadores del seed, que no son UUID canónicos", () => {
    const resultado = reporteSimpleSchema.safeParse({
      ordenId: ORDEN_ID,
      usuarioId: SECRETARIA_ID,
      reporte: "etiquetas",
    });

    expect(resultado.success).toBe(true);
  });

  it("rechaza una orden que no tiene forma de identificador", () => {
    const errores = erroresDe(reporteSimpleSchema, {
      ordenId: "la-sexta",
      usuarioId: SECRETARIA_ID,
      reporte: "etiquetas",
    });

    expect(errores.ordenId).toContain(
      "No se sabe de qué orden es este reporte",
    );
  });
});

describe("facturaSchema", () => {
  it("acepta el número de la factura externa", () => {
    const resultado = facturaSchema.safeParse({
      ordenId: ORDEN_ID,
      usuarioId: SECRETARIA_ID,
      numeroFactura: "FE-9021",
    });

    expect(resultado.success).toBe(true);
  });

  it("no deja reportar la factura sin número", () => {
    const errores = erroresDe(facturaSchema, {
      ordenId: ORDEN_ID,
      usuarioId: SECRETARIA_ID,
      numeroFactura: "   ",
    });

    expect(errores.numeroFactura).toContain("Escribe el número de la factura");
  });

  it("quita los espacios sobrantes del número", () => {
    const resultado = facturaSchema.safeParse({
      ordenId: ORDEN_ID,
      usuarioId: SECRETARIA_ID,
      numeroFactura: "  FE-9021  ",
    });

    expect(resultado.success && resultado.data.numeroFactura).toBe("FE-9021");
  });
});

describe("cierreSchema", () => {
  it("acepta el cierre con quien lo hace", () => {
    const resultado = cierreSchema.safeParse({
      ordenId: ORDEN_ID,
      usuarioId: SECRETARIA_ID,
    });

    expect(resultado.success).toBe(true);
  });

  it("pide saber quién cierra, para dejar el registro", () => {
    const errores = erroresDe(cierreSchema, {
      ordenId: ORDEN_ID,
      usuarioId: "",
    });

    expect(errores.usuarioId).toContain(
      "Escoge quién está haciendo el reporte",
    );
  });
});
