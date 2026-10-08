import { describe, expect, it } from "vitest";

import {
  puedeConfirmarRecepcion,
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
    expect(puedeDespachar(HASTA_CORTE, "logistica")).toEqual({
      permitido: true,
    });
  });

  it("no deja que otro rol despache, y dice a quién le toca", () => {
    const resultado = puedeDespachar(HASTA_CORTE, "corte");

    expect(resultado.permitido).toBe(false);
    expect(resultado.permitido === false && resultado.mensaje).toContain(
      "Logística",
    );
  });

  it("no deja despachar si el corte no está completado", () => {
    const resultado = puedeDespachar(SIN_CORTE, "logistica");

    expect(resultado.permitido).toBe(false);
    expect(resultado.permitido === false && resultado.mensaje).toContain(
      "Corte completado",
    );
  });

  it("no deja despachar una orden recién registrada", () => {
    expect(puedeDespachar([], "logistica")).toMatchObject({
      permitido: false,
    });
  });

  it("deja despachar otro lote aunque ya haya salido uno", () => {
    // Regla 6: una orden se reparte entre varios talleres. La regla mira el
    // corte, no cuántos lotes se hayan mandado antes.
    expect(puedeDespachar(HASTA_CORTE, "logistica")).toEqual({
      permitido: true,
    });
  });
});

describe("puedeConfirmarRecepcion", () => {
  it("deja confirmar un lote que sigue en el taller", () => {
    expect(puedeConfirmarRecepcion({ recibido: false }, "logistica")).toEqual({
      permitido: true,
    });
  });

  it("no deja que otro rol confirme la recepción", () => {
    const resultado = puedeConfirmarRecepcion({ recibido: false }, "marcacion");

    expect(resultado.permitido).toBe(false);
    expect(resultado.permitido === false && resultado.mensaje).toContain(
      "Logística",
    );
  });

  it("no deja confirmar dos veces el mismo lote", () => {
    const resultado = puedeConfirmarRecepcion({ recibido: true }, "logistica");

    expect(resultado.permitido).toBe(false);
    expect(resultado.permitido === false && resultado.mensaje).toContain(
      "Ya se confirmó",
    );
  });

  it("no deja confirmar un lote que no pertenece a la orden", () => {
    // Criterio de aceptación: solo se puede confirmar si la orden fue
    // despachada antes. Sin un lote de verdad, no hay qué confirmar.
    const resultado = puedeConfirmarRecepcion(undefined, "logistica");

    expect(resultado.permitido).toBe(false);
    expect(resultado.permitido === false && resultado.mensaje).toContain(
      "no pertenece",
    );
  });
});
