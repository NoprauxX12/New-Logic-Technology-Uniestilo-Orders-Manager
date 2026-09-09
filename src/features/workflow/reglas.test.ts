import { describe, expect, it } from "vitest";

import { validarMarcacionCorte } from "@/features/workflow/reglas";

describe("validarMarcacionCorte", () => {
  it("permite completar corte cuando las etapas anteriores están listas", () => {
    const resultado = validarMarcacionCorte({
      ordenExiste: true,
      checkpointsCompletados: [
        "cotizacion_aprobada",
        "programada_diseno",
        "ficha_adjunta",
        "tela_programada",
      ],
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
      checkpointsCompletados: [
        "cotizacion_aprobada",
        "programada_diseno",
        "ficha_adjunta",
        "tela_programada",
        "corte_completado",
      ],
    });

    expect(resultado).toEqual({
      permitido: false,
      motivo: "ya_marcado",
      mensaje: '"Corte completado" ya está marcado en esta orden.',
    });
  });
});
