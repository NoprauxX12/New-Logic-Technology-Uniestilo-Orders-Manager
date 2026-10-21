import { describe, expect, it } from "vitest";

import {
  agruparErroresCorreccion,
  leerFormularioCorreccion,
  leerFormularioDevolucion,
} from "@/features/correcciones/formulario";
import { MOTIVO_MAXIMO } from "@/features/correcciones/reglas";
import {
  devolverOrdenSchema,
  ordenCorreccionSchema,
} from "@/features/correcciones/schemas";

const ORDEN = "00000000-0000-0000-0000-0000000000f7";
const PRENDA = "00000000-0000-0000-0000-0000000001aa";

function formulario(campos: [string, string][]): FormData {
  const datos = new FormData();
  for (const [nombre, valor] of campos) datos.append(nombre, valor);
  return datos;
}

describe("devolverOrdenSchema", () => {
  const valida = {
    ordenId: ORDEN,
    checkpoint: "corte_completado",
    motivo: "Manga corta",
  };

  it("acepta una devolución completa", () => {
    expect(devolverOrdenSchema.safeParse(valida).success).toBe(true);
  });

  it("el motivo es obligatorio, aunque sean solo espacios", () => {
    const resultado = devolverOrdenSchema.safeParse({
      ...valida,
      motivo: "   ",
    });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0].message).toMatch(/por qué se devuelve/);
  });

  it("el motivo tiene un largo máximo", () => {
    const resultado = devolverOrdenSchema.safeParse({
      ...valida,
      motivo: "x".repeat(MOTIVO_MAXIMO + 1),
    });

    expect(resultado.success).toBe(false);
  });

  it("solo acepta etapas del flujo y ids de orden", () => {
    expect(
      devolverOrdenSchema.safeParse({ ...valida, checkpoint: "inventada" })
        .success,
    ).toBe(false);
    expect(
      devolverOrdenSchema.safeParse({ ...valida, ordenId: "no-es-id" }).success,
    ).toBe(false);
  });

  it("quien actúa no viaja en el formulario: no hay campo de usuario", () => {
    const leido = leerFormularioDevolucion(
      formulario([
        ["ordenId", ORDEN],
        ["checkpoint", "corte_completado"],
        ["motivo", "x"],
        ["usuarioId", "00000000-0000-0000-0000-0000000000a1"],
      ]),
    );

    expect(Object.keys(leido)).toEqual(["ordenId", "checkpoint", "motivo"]);
  });
});

describe("ordenCorreccionSchema", () => {
  const valida = {
    ordenOriginalId: ORDEN,
    fechaEntrega: "2999-01-01",
    motivo: "Costura abierta",
    etapaInicial: "corte_completado",
    items: [{ itemId: PRENDA, cantidad: "12", tallas: "S:8, M:4" }],
  };

  it("acepta una corrección completa y convierte la cantidad a número", () => {
    const resultado = ordenCorreccionSchema.safeParse(valida);

    expect(resultado.success).toBe(true);
    expect(resultado.data?.items[0].cantidad).toBe(12);
  });

  it("pide al menos una prenda", () => {
    const resultado = ordenCorreccionSchema.safeParse({ ...valida, items: [] });

    expect(resultado.error?.issues[0].message).toMatch(/al menos una prenda/);
  });

  it("la cantidad es un entero mayor que cero", () => {
    for (const cantidad of ["0", "-2", "1.5", "doce", ""]) {
      expect(
        ordenCorreccionSchema.safeParse({
          ...valida,
          items: [{ itemId: PRENDA, cantidad, tallas: "S:1" }],
        }).success,
      ).toBe(false);
    }
  });

  it("las tallas son obligatorias y de texto libre", () => {
    expect(
      ordenCorreccionSchema.safeParse({
        ...valida,
        items: [{ itemId: PRENDA, cantidad: "3", tallas: "  " }],
      }).success,
    ).toBe(false);
    expect(
      ordenCorreccionSchema.safeParse({
        ...valida,
        items: [{ itemId: PRENDA, cantidad: "3", tallas: "las más pequeñas" }],
      }).success,
    ).toBe(true);
  });

  it("la fecha de entrega no puede ser anterior a hoy", () => {
    const resultado = ordenCorreccionSchema.safeParse({
      ...valida,
      fechaEntrega: "2020-01-01",
    });

    expect(resultado.error?.issues[0].message).toMatch(/anterior a hoy/);
  });

  it("la etapa de entrada no puede ser una de cierre", () => {
    expect(
      ordenCorreccionSchema.safeParse({ ...valida, etapaInicial: "cerrada" })
        .success,
    ).toBe(false);
    expect(
      ordenCorreccionSchema.safeParse({
        ...valida,
        etapaInicial: "lista_despacho",
      }).success,
    ).toBe(true);
  });

  it("el motivo es obligatorio", () => {
    expect(
      ordenCorreccionSchema.safeParse({ ...valida, motivo: "" }).success,
    ).toBe(false);
  });
});

describe("leerFormularioCorreccion", () => {
  it("solo toma las prendas cuya casilla está marcada", () => {
    const leido = leerFormularioCorreccion(
      formulario([
        ["ordenOriginalId", ORDEN],
        ["fechaEntrega", "2999-01-01"],
        ["motivo", "Defecto"],
        ["etapaInicial", "corte_completado"],
        ["incluir", PRENDA],
        [`cantidad.${PRENDA}`, "5"],
        [`tallas.${PRENDA}`, "S:5"],
        // Una prenda con datos pero sin casilla: no entra.
        ["cantidad.otra", "9"],
        ["tallas.otra", "M:9"],
      ]),
    );

    expect(leido.items).toEqual([
      { itemId: PRENDA, cantidad: "5", tallas: "S:5" },
    ]);
  });

  it("los errores de una prenda salen con su id en la clave", () => {
    const escrito = leerFormularioCorreccion(
      formulario([
        ["ordenOriginalId", ORDEN],
        ["fechaEntrega", "2999-01-01"],
        ["motivo", "Defecto"],
        ["etapaInicial", "corte_completado"],
        ["incluir", PRENDA],
        [`cantidad.${PRENDA}`, "0"],
        [`tallas.${PRENDA}`, ""],
      ]),
    );
    const resultado = ordenCorreccionSchema.safeParse(escrito);

    expect(resultado.success).toBe(false);
    const errores = agruparErroresCorreccion(resultado.error!, escrito);
    expect(errores[`cantidad.${PRENDA}`]).toBeDefined();
    expect(errores[`tallas.${PRENDA}`]).toBeDefined();
  });
});
