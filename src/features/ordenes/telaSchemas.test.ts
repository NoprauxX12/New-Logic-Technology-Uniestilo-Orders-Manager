import { describe, expect, it } from "vitest";

import {
  itemTelaSchema,
  programarTelaSchema,
} from "@/features/ordenes/telaSchemas";

const itemValido = {
  itemId: "123e4567-e89b-42d3-a456-426614174000",
  tipoTela: "Tela impermeable azul",
  cantidadTela: "120,5",
  unidadTela: "metros",
  observacionesTela: "",
};

describe("HU-05 · datos de tela", () => {
  it.each(["120,5", "120.5"])(
    "acepta la cantidad %s y la convierte a número",
    (cantidadTela) => {
      const resultado = itemTelaSchema.parse({
        ...itemValido,
        cantidadTela,
      });

      expect(resultado.cantidadTela).toBe(120.5);
    },
  );

  it.each(["", "0", "-2", "abc", "12.345"])(
    "rechaza la cantidad inválida %s",
    (cantidadTela) => {
      expect(
        itemTelaSchema.safeParse({
          ...itemValido,
          cantidadTela,
        }).success,
      ).toBe(false);
    },
  );

  it("rechaza un tipo de tela vacío", () => {
    expect(
      itemTelaSchema.safeParse({
        ...itemValido,
        tipoTela: "   ",
      }).success,
    ).toBe(false);
  });

  it.each(["metros", "kilos"])("acepta la unidad %s", (unidadTela) => {
    expect(
      itemTelaSchema.safeParse({
        ...itemValido,
        unidadTela,
      }).success,
    ).toBe(true);
  });

  it("rechaza unidades diferentes de metros o kilos", () => {
    expect(
      itemTelaSchema.safeParse({
        ...itemValido,
        unidadTela: "litros",
      }).success,
    ).toBe(false);
  });

  it("permite omitir las observaciones", () => {
    expect(
      itemTelaSchema.safeParse({
        ...itemValido,
        observacionesTela: undefined,
      }).success,
    ).toBe(true);
  });
});

describe("HU-05 · programación de la orden", () => {
  const ordenId = "123e4567-e89b-42d3-a456-426614174001";

  it("acepta una orden con sus datos de tela completos", () => {
    expect(
      programarTelaSchema.safeParse({
        ordenId,
        items: [itemValido],
      }).success,
    ).toBe(true);
  });

  it("rechaza una orden sin ítems", () => {
    expect(
      programarTelaSchema.safeParse({
        ordenId,
        items: [],
      }).success,
    ).toBe(false);
  });

  it("rechaza ítems repetidos", () => {
    expect(
      programarTelaSchema.safeParse({
        ordenId,
        items: [itemValido, itemValido],
      }).success,
    ).toBe(false);
  });
});
