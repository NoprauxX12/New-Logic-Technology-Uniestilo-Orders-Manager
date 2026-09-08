import { describe, expect, it } from "vitest";

import { validarMarcacionCorte } from "@/features/workflow/reglas";

describe("validarMarcacionCorte", () => {
  it("permite completar corte para una orden registrada", () => {
    const resultado = validarMarcacionCorte({
      ordenExiste: true,
      checkpointsCompletados: [],
    });

    expect(resultado).toEqual({ permitido: true });
  });

  it("rechaza la marcación cuando la orden no existe", () => {
    const resultado = validarMarcacionCorte({
      ordenExiste: false,
      checkpointsCompletados: [],
    });

    expect(resultado).toEqual({
      permitido: false,
      mensaje: "La orden indicada no existe.",
    });
  });

  it("rechaza marcar corte dos veces para la misma orden", () => {
    const resultado = validarMarcacionCorte({
      ordenExiste: true,
      checkpointsCompletados: ["corte_completado"],
    });

    expect(resultado).toEqual({
      permitido: false,
      mensaje: "La etapa de corte ya fue marcada como completada.",
    });
  });
});
