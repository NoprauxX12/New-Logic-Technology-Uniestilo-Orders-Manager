import { describe, expect, it } from "vitest";

import { leerFormularioInsumos } from "@/features/insumos/formulario";
import { validarInsumosSchema } from "@/features/insumos/schemas";

const ORDEN = "00000000-0000-0000-0000-0000000000f2";

function primerMensaje(entrada: unknown): string | undefined {
  const resultado = validarInsumosSchema.safeParse(entrada);
  return resultado.success ? undefined : resultado.error.issues[0]?.message;
}

describe("validarInsumosSchema", () => {
  it("acepta un listado con cuánto y cómo de cada insumo, sin espacios sobrantes", () => {
    const resultado = validarInsumosSchema.safeParse({
      ordenId: ORDEN,
      insumos: [
        { insumo: "hilo", detalle: "  10 conos de hilo azul " },
        { insumo: "boton", detalle: "200 botones" },
      ],
    });

    expect(resultado.success).toBe(true);
    expect(resultado.data?.insumos[0].detalle).toBe("10 conos de hilo azul");
  });

  it("pide al menos un insumo", () => {
    expect(primerMensaje({ ordenId: ORDEN, insumos: [] })).toBe(
      "Marca al menos un insumo de la orden",
    );
  });

  it("pide el detalle de cada insumo marcado", () => {
    expect(
      primerMensaje({
        ordenId: ORDEN,
        insumos: [{ insumo: "hilo", detalle: "  " }],
      }),
    ).toBe("Escribe cuánto y cómo de cada insumo que marcaste");
  });

  it("pone tope al detalle, igual que la base", () => {
    expect(
      primerMensaje({
        ordenId: ORDEN,
        insumos: [{ insumo: "hilo", detalle: "x".repeat(301) }],
      }),
    ).toBe("El detalle va hasta 300 caracteres");
  });

  it("solo acepta los insumos del catálogo", () => {
    expect(
      primerMensaje({
        ordenId: ORDEN,
        insumos: [{ insumo: "tela", detalle: "20 m" }],
      }),
    ).toBe("Uno de los insumos no es de la lista");
  });

  it("no deja un insumo dos veces", () => {
    expect(
      primerMensaje({
        ordenId: ORDEN,
        insumos: [
          { insumo: "hilo", detalle: "10" },
          { insumo: "hilo", detalle: "5" },
        ],
      }),
    ).toBe("Un insumo está dos veces en el listado");
  });

  it("exige una orden válida", () => {
    expect(
      primerMensaje({
        ordenId: "no",
        insumos: [{ insumo: "hilo", detalle: "1" }],
      }),
    ).toBe("No se pudo identificar la orden");
  });
});

describe("leerFormularioInsumos", () => {
  it("lee solo los insumos marcados, cada uno con su detalle", () => {
    const datos = new FormData();
    datos.set("ordenId", ORDEN);
    datos.append("insumo", "hilo");
    datos.append("insumo", "cierre");
    datos.set("detalle.hilo", "10 conos");
    datos.set("detalle.cierre", "80 cierres");
    // Escrito y después desmarcado: no cuenta.
    datos.set("detalle.boton", "200 botones");

    expect(leerFormularioInsumos(datos)).toEqual({
      ordenId: ORDEN,
      insumos: [
        { insumo: "hilo", detalle: "10 conos" },
        { insumo: "cierre", detalle: "80 cierres" },
      ],
    });
  });

  it("sin nada marcado, el listado llega vacío", () => {
    const datos = new FormData();
    datos.set("ordenId", ORDEN);

    expect(leerFormularioInsumos(datos)).toEqual({
      ordenId: ORDEN,
      insumos: [],
    });
  });
});
