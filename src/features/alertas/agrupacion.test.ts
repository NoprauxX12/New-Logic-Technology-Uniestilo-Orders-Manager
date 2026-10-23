import { describe, expect, it } from "vitest";

import { agruparOrdenesDeTelas } from "@/features/alertas/agrupacion";
import type { OrdenParaTelas } from "@/features/alertas/queries";

/**
 * Secretaría valida la tela: lo que le toca hacer primero, lo que espera que
 * llegue (la que lleva más días primero) y, plegado, lo que ya llegó.
 */

const AHORA = new Date("2026-10-23T15:00:00Z");

function orden(
  numero: string,
  cambios: Partial<OrdenParaTelas> = {},
): OrdenParaTelas {
  return {
    id: numero,
    numeroOrdenCompra: numero,
    razonSocial: "Cliente",
    fechaEntrega: "2026-12-01",
    avisoAbierto: null,
    ultimaLlegada: null,
    veredictoAviso: { permitido: true },
    veredictoLlegada: { permitido: false, mensaje: "" },
    fichas: [],
    ...cambios,
  } as OrdenParaTelas;
}

const aviso = (fechaCreacion: string) => ({
  detalle: "Faltan 40 metros",
  fechaCreacion,
  atendido: false,
});

const numeros = (lista: OrdenParaTelas[]) =>
  lista.map((o) => o.numeroOrdenCompra);

describe("agruparOrdenesDeTelas", () => {
  it("separa por validar, esperando tela y tela llegada", () => {
    const grupos = agruparOrdenesDeTelas(
      [
        orden("LLEGO", { ultimaLlegada: "2026-10-20T10:00:00Z" }),
        orden("ESPERA", { avisoAbierto: aviso("2026-10-18T10:00:00Z") }),
        orden("NUEVA"),
      ],
      AHORA,
    );

    expect(numeros(grupos.porValidar)).toEqual(["NUEVA"]);
    expect(numeros(grupos.esperandoTela)).toEqual(["ESPERA"]);
    expect(numeros(grupos.telaLlegada)).toEqual(["LLEGO"]);
  });

  it("una orden con aviso abierto cuenta como esperando aunque ya haya recibido tela antes", () => {
    const grupos = agruparOrdenesDeTelas(
      [
        orden("DE-NUEVO", {
          avisoAbierto: aviso("2026-10-22T10:00:00Z"),
          ultimaLlegada: "2026-10-01T10:00:00Z",
        }),
      ],
      AHORA,
    );

    expect(numeros(grupos.esperandoTela)).toEqual(["DE-NUEVO"]);
    expect(grupos.telaLlegada).toEqual([]);
  });

  it("por validar: primero las más urgentes", () => {
    const grupos = agruparOrdenesDeTelas(
      [
        orden("TRANQUILA", { fechaEntrega: "2026-12-30" }),
        orden("ATRASADA", { fechaEntrega: "2026-10-10" }),
      ],
      AHORA,
    );

    expect(numeros(grupos.porValidar)).toEqual(["ATRASADA", "TRANQUILA"]);
  });

  it("esperando tela: primero la que lleva más días esperando, aunque sea menos urgente", () => {
    const grupos = agruparOrdenesDeTelas(
      [
        orden("RECIENTE-URGENTE", {
          avisoAbierto: aviso("2026-10-22T10:00:00Z"),
          fechaEntrega: "2026-10-24",
        }),
        orden("VIEJA-TRANQUILA", {
          avisoAbierto: aviso("2026-10-05T10:00:00Z"),
          fechaEntrega: "2026-12-30",
        }),
      ],
      AHORA,
    );

    expect(numeros(grupos.esperandoTela)).toEqual([
      "VIEJA-TRANQUILA",
      "RECIENTE-URGENTE",
    ]);
  });

  it("sin órdenes da tres grupos vacíos", () => {
    expect(agruparOrdenesDeTelas([], AHORA)).toEqual({
      porValidar: [],
      esperandoTela: [],
      telaLlegada: [],
    });
  });
});
