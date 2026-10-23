import { describe, expect, it } from "vitest";

import {
  agruparOrdenesDeTalleres,
  describirDiasEnTaller,
} from "@/features/talleres/agrupacion";
import type { OrdenParaTalleres } from "@/features/talleres/queries";

/**
 * Logística tiene tres tareas y cada orden está en una: mandarla al taller,
 * esperar que vuelva, o ya haberla recibido.
 */

const AHORA = new Date("2026-10-23T15:00:00Z");

function orden(
  numero: string,
  cambios: Partial<OrdenParaTalleres> = {},
): OrdenParaTalleres {
  return {
    id: numero,
    numeroOrdenCompra: numero,
    razonSocial: "Cliente",
    fechaEntrega: "2026-12-01",
    estadoTalleres: "",
    lotesTotales: 0,
    lotesSinRecibir: 0,
    enTallerDesde: null,
    ...cambios,
  };
}

const numeros = (lista: OrdenParaTalleres[]) =>
  lista.map((o) => o.numeroOrdenCompra);

describe("agruparOrdenesDeTalleres", () => {
  it("separa lo que falta despachar, lo que está en el taller y lo que ya volvió", () => {
    const grupos = agruparOrdenesDeTalleres(
      [
        orden("VOLVIO", { lotesTotales: 2, lotesSinRecibir: 0 }),
        orden("AFUERA", {
          lotesTotales: 1,
          lotesSinRecibir: 1,
          enTallerDesde: "2026-10-20T10:00:00Z",
        }),
        orden("NUEVA"),
      ],
      AHORA,
    );

    expect(numeros(grupos.porDespachar)).toEqual(["NUEVA"]);
    expect(numeros(grupos.enElTaller)).toEqual(["AFUERA"]);
    expect(numeros(grupos.volvieron)).toEqual(["VOLVIO"]);
  });

  it("una orden con un lote recibido y otro afuera cuenta como «en el taller»", () => {
    const grupos = agruparOrdenesDeTalleres(
      [
        orden("MIXTA", {
          lotesTotales: 2,
          lotesSinRecibir: 1,
          enTallerDesde: "2026-10-21T10:00:00Z",
        }),
      ],
      AHORA,
    );

    expect(numeros(grupos.enElTaller)).toEqual(["MIXTA"]);
    expect(grupos.volvieron).toEqual([]);
  });

  it("por despachar: primero las más urgentes", () => {
    const grupos = agruparOrdenesDeTalleres(
      [
        orden("TRANQUILA", { fechaEntrega: "2026-12-20" }),
        orden("ATRASADA", { fechaEntrega: "2026-10-15" }),
        orden("EN-RIESGO", { fechaEntrega: "2026-10-26" }),
      ],
      AHORA,
    );

    expect(numeros(grupos.porDespachar)).toEqual([
      "ATRASADA",
      "EN-RIESGO",
      "TRANQUILA",
    ]);
  });

  it("en el taller: primero la que lleva más días afuera, aunque sea menos urgente", () => {
    const afuera = (desde: string, entrega: string) => ({
      lotesTotales: 1,
      lotesSinRecibir: 1,
      enTallerDesde: desde,
      fechaEntrega: entrega,
    });

    const grupos = agruparOrdenesDeTalleres(
      [
        orden("RECIENTE-URGENTE", afuera("2026-10-22T10:00:00Z", "2026-10-24")),
        orden("VIEJA-TRANQUILA", afuera("2026-10-10T10:00:00Z", "2026-12-30")),
      ],
      AHORA,
    );

    expect(numeros(grupos.enElTaller)).toEqual([
      "VIEJA-TRANQUILA",
      "RECIENTE-URGENTE",
    ]);
  });

  it("una lista vacía da tres grupos vacíos y no se modifica la entrada", () => {
    expect(agruparOrdenesDeTalleres([], AHORA)).toEqual({
      porDespachar: [],
      enElTaller: [],
      volvieron: [],
    });

    const entrada = [orden("B", { fechaEntrega: "2026-12-20" }), orden("A")];
    const copia = [...entrada];
    agruparOrdenesDeTalleres(entrada, AHORA);
    expect(entrada).toEqual(copia);
  });
});

describe("describirDiasEnTaller", () => {
  it.each([
    ["2026-10-23T08:00:00Z", "Salió hoy al taller"],
    ["2026-10-22T08:00:00Z", "Lleva 1 día en el taller"],
    ["2026-10-18T08:00:00Z", "Lleva 5 días en el taller"],
  ])("%s → %s", (desde, esperado) => {
    expect(describirDiasEnTaller(desde, AHORA)).toBe(esperado);
  });
});
