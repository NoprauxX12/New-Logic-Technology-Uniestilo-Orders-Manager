import { describe, expect, it } from "vitest";

import { compararPorUrgencia } from "@/lib/ordenes/urgencia";

const AHORA = new Date("2026-10-23T15:00:00Z");

const orden = (numeroOrdenCompra: string, fechaEntrega: string) => ({
  numeroOrdenCompra,
  fechaEntrega,
});

const ordenar = (lista: ReturnType<typeof orden>[]) =>
  [...lista].sort(compararPorUrgencia(AHORA)).map((o) => o.numeroOrdenCompra);

describe("compararPorUrgencia", () => {
  it("primero las atrasadas, luego las en riesgo, luego las que van a tiempo", () => {
    expect(
      ordenar([
        orden("A-TIEMPO", "2026-12-01"),
        orden("EN-RIESGO", "2026-10-25"),
        orden("ATRASADA", "2026-10-20"),
      ]),
    ).toEqual(["ATRASADA", "EN-RIESGO", "A-TIEMPO"]);
  });

  it("a igual urgencia gana la de entrega más cercana", () => {
    expect(
      ordenar([orden("DESPUES", "2026-12-20"), orden("ANTES", "2026-11-20")]),
    ).toEqual(["ANTES", "DESPUES"]);
  });

  it("con la misma entrega desempata por número de orden, siempre igual", () => {
    expect(
      ordenar([orden("OC-2", "2026-12-01"), orden("OC-1", "2026-12-01")]),
    ).toEqual(["OC-1", "OC-2"]);
  });

  it("cuenta el día en Bogotá: a las 8 p. m. lo que vence hoy sigue en riesgo, no atrasada", () => {
    const noche = new Date("2026-10-24T01:00:00Z"); // 8 p. m. del 23 en Colombia
    const lista = [
      orden("MAÑANA", "2026-10-24"),
      orden("HOY", "2026-10-23"),
      orden("AYER", "2026-10-22"),
    ];

    expect(
      [...lista]
        .sort(compararPorUrgencia(noche))
        .map((o) => o.numeroOrdenCompra),
    ).toEqual(["AYER", "HOY", "MAÑANA"]);
  });
});
