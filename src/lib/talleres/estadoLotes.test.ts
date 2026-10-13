import { describe, expect, it } from "vitest";

import {
  describirEstadoDeTalleres,
  lotesEnTaller,
} from "@/lib/talleres/estadoLotes";

/**
 * Cómo se lee el estado de una orden en cuanto a talleres. Vive en `lib/`
 * porque lo necesitan dos features: el detalle de la orden (talleres) y el
 * tablero (HU-10 y HU-11 piden que "en confección" se vea allí).
 */

describe("lotesEnTaller", () => {
  it("deja fuera los que ya volvieron", () => {
    const lotes = [
      { recibido: true },
      { recibido: false },
      { recibido: false },
    ];

    expect(lotesEnTaller(lotes)).toHaveLength(2);
  });
});

describe("describirEstadoDeTalleres", () => {
  it("dice que no ha salido cuando no hay lotes", () => {
    expect(describirEstadoDeTalleres([])).toBe(
      "Todavía no ha salido a ningún taller.",
    );
  });

  it("dice que está en confección con un lote afuera", () => {
    expect(describirEstadoDeTalleres([{ recibido: false }])).toBe(
      "En confección.",
    );
  });

  it("cuenta los lotes cuando hay varios", () => {
    const estado = describirEstadoDeTalleres([
      { recibido: false },
      { recibido: true },
      { recibido: false },
    ]);

    expect(estado).toContain("2 de 3");
  });

  it("avisa cuando todo volvió del taller", () => {
    expect(describirEstadoDeTalleres([{ recibido: true }])).toBe(
      "Todo el trabajo volvió del taller.",
    );
  });
});
