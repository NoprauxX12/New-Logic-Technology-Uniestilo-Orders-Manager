import { describe, expect, it } from "vitest";

import {
  listadoVigente,
  ordenarListado,
  puedeValidarInsumos,
} from "@/features/insumos/reglas";
import {
  CHECKPOINTS,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { siguienteCheckpoint } from "@/features/workflow/transiciones";

/** Todos los checkpoints del flujo hasta `ultimo`, incluido. */
function hasta(ultimo: CheckpointId): CheckpointId[] {
  const fin = CHECKPOINTS.findIndex((checkpoint) => checkpoint.id === ultimo);
  return CHECKPOINTS.slice(0, fin + 1).map((checkpoint) => checkpoint.id);
}

describe("la etapa de insumos en el flujo (HU-23)", () => {
  it("va justo después de la tela y antes del corte", () => {
    const ids = CHECKPOINTS.map((checkpoint) => checkpoint.id);
    const lugar = ids.indexOf("insumos_validados");

    expect(ids[lugar - 1]).toBe("tela_programada");
    expect(ids[lugar + 1]).toBe("corte_completado");
  });

  it("con la tela programada, lo que sigue es validar los insumos", () => {
    expect(siguienteCheckpoint(hasta("tela_programada"))).toBe(
      "insumos_validados",
    );
  });

  it("con los insumos validados, lo que sigue es el corte", () => {
    expect(siguienteCheckpoint(hasta("insumos_validados"))).toBe(
      "corte_completado",
    );
  });

  it("una orden que ya iba en corte cuando se encendió la etapa no se tranca", () => {
    const sinInsumos = hasta("corte_completado").filter(
      (checkpoint) => checkpoint !== "insumos_validados",
    );

    expect(siguienteCheckpoint(sinInsumos)).toBe("recogido_bordado");
    expect(puedeValidarInsumos(sinInsumos, "secretaria")).toMatchObject({
      permitido: false,
      motivo: "fuera_de_secuencia",
    });
  });

  it("una corrección que entra por el corte no pasa por los insumos", () => {
    expect(siguienteCheckpoint([], "corte_completado")).toBe(
      "corte_completado",
    );
  });
});

describe("puedeValidarInsumos", () => {
  it("secretaría valida cuando la tela ya está programada", () => {
    expect(puedeValidarInsumos(hasta("tela_programada"), "secretaria")).toEqual(
      { permitido: true },
    );
  });

  it("antes de la tela, todavía no", () => {
    expect(
      puedeValidarInsumos(hasta("ficha_adjunta"), "secretaria"),
    ).toMatchObject({
      permitido: false,
      motivo: "fuera_de_secuencia",
      mensaje: 'Antes hay que marcar "Tela programada".',
    });
  });

  it("nadie más los valida, ni administración", () => {
    for (const rol of ["admin", "corte", "logistica"] as const) {
      expect(puedeValidarInsumos(hasta("tela_programada"), rol)).toMatchObject({
        permitido: false,
        motivo: "rol_no_autorizado",
        mensaje: '"Insumos validados" lo marca Secretaría.',
      });
    }
  });

  it("no se validan dos veces", () => {
    expect(
      puedeValidarInsumos(hasta("insumos_validados"), "secretaria"),
    ).toMatchObject({ permitido: false, motivo: "ya_marcado" });
  });
});

describe("listado de insumos", () => {
  it("se ordena como el catálogo, no como se marcó", () => {
    expect(
      ordenarListado([
        { insumo: "estampado", detalle: "Escudo" },
        { insumo: "hilo", detalle: "10 conos" },
        { insumo: "boton", detalle: "200" },
      ]).map((item) => item.insumo),
    ).toEqual(["hilo", "boton", "estampado"]);
  });

  it("solo cuenta la validación vigente: lo anulado por una devolución queda atrás", () => {
    expect(
      listadoVigente([
        {
          insumo: "boton",
          detalle: "200 blancos",
          avance: { anuladoPor: "r1" },
        },
        { insumo: "hilo", detalle: "8 conos", avance: { anuladoPor: "r1" } },
        {
          insumo: "boton",
          detalle: "300 negros",
          avance: { anuladoPor: null },
        },
        { insumo: "cierre", detalle: "sin avance", avance: null },
      ]),
    ).toEqual([{ insumo: "boton", detalle: "300 negros" }]);
  });

  it("sin validación, el listado está vacío", () => {
    expect(listadoVigente([])).toEqual([]);
  });
});
