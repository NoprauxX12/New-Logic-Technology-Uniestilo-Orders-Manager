import { describe, expect, it } from "vitest";

import { validarLlegadaMarcacion } from "@/features/workflow/reglasMarcacion";

const ETAPAS_ANTERIORES = [
  "cotizacion_aprobada",
  "programada_diseno",
  "ficha_adjunta",
  "tela_programada",
  "corte_completado",
  "recogido_bordado",
] as const;

describe("validarLlegadaMarcacion", () => {
  it("permite marcar la llegada cuando logística confirmó la recepción", () => {
    const resultado = validarLlegadaMarcacion({
      ordenExiste: true,
      recepcionConfirmada: true,
      checkpointsCompletados: ETAPAS_ANTERIORES,
    });

    expect(resultado).toEqual({ permitido: true });
  });

  it("rechaza la llegada cuando logística no confirmó la recepción", () => {
    const resultado = validarLlegadaMarcacion({
      ordenExiste: true,
      recepcionConfirmada: false,
      checkpointsCompletados: ETAPAS_ANTERIORES,
    });

    expect(resultado).toEqual({
      permitido: false,
      mensaje: "Logística debe confirmar primero la recepción de las prendas.",
    });
  });

  it("rechaza marcar la llegada dos veces para la misma orden", () => {
    const resultado = validarLlegadaMarcacion({
      ordenExiste: true,
      recepcionConfirmada: true,
      checkpointsCompletados: [...ETAPAS_ANTERIORES, "llegada_marcacion"],
    });

    expect(resultado).toEqual({
      permitido: false,
      motivo: "ya_marcado",
      mensaje: '"Llegada a marcación" ya está marcado en esta orden.',
    });
  });
});
