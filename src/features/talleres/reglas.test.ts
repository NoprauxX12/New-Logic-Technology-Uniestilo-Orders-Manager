import { describe, expect, it } from "vitest";

import {
  describirEstadoDeTalleres,
  lotesEnTaller,
  puedeDespachar,
} from "@/features/talleres/reglas";
import type { CheckpointId } from "@/features/workflow/checkpoints";

/**
 * HU-10 · Las reglas del despacho. Aquí está el riesgo del dominio: que se
 * mande al taller una orden sin cortar, y que el estado que se muestra no
 * corresponda con los lotes que hay.
 */

const HASTA_CORTE: CheckpointId[] = [
  "cotizacion_aprobada",
  "programada_diseno",
  "ficha_adjunta",
  "tela_programada",
  "corte_completado",
];

const SIN_CORTE: CheckpointId[] = [
  "cotizacion_aprobada",
  "programada_diseno",
  "ficha_adjunta",
  "tela_programada",
];

describe("puedeDespachar", () => {
  it("deja despachar cuando el corte está completado", () => {
    expect(puedeDespachar(HASTA_CORTE)).toEqual({ permitido: true });
  });

  it("no deja despachar si el corte no está completado", () => {
    const resultado = puedeDespachar(SIN_CORTE);

    expect(resultado.permitido).toBe(false);
    expect(resultado.permitido === false && resultado.mensaje).toContain(
      "Corte completado",
    );
  });

  it("no deja despachar una orden recién registrada", () => {
    expect(puedeDespachar([])).toMatchObject({ permitido: false });
  });

  it("deja despachar otro lote aunque ya haya salido uno", () => {
    // Regla 6: una orden se reparte entre varios talleres. La regla mira el
    // corte, no cuántos lotes se hayan mandado antes.
    expect(puedeDespachar(HASTA_CORTE)).toEqual({ permitido: true });
  });
});

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
