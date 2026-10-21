import { describe, expect, it } from "vitest";

import {
  CHECKPOINTS_DISPONIBLES,
  buscarCheckpoint,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";
import {
  etapasQueNoAplicaron,
  puedeMarcar,
  siguienteCheckpoint,
} from "@/features/workflow/transiciones";

/**
 * HU-18 · Una orden de corrección entra al flujo por su etapa inicial, y una
 * orden devuelta se comporta como si las etapas anuladas no estuvieran marcadas
 * (el motor solo recibe los avances vigentes).
 */

const DISPONIBLES: CheckpointId[] = CHECKPOINTS_DISPONIBLES.map((c) => c.id);

describe("etapa inicial de una orden de corrección", () => {
  it("la siguiente etapa es la de entrada, aunque no tenga ningún avance", () => {
    expect(siguienteCheckpoint([], "corte_completado")).toBe(
      "corte_completado",
    );
  });

  it("sin etapa inicial recorre el flujo completo desde el principio", () => {
    expect(siguienteCheckpoint([], null)).toBe(DISPONIBLES[0]);
    expect(siguienteCheckpoint([], undefined)).toBe(DISPONIBLES[0]);
  });

  it("las etapas anteriores a la de entrada no aplican", () => {
    const noAplican = etapasQueNoAplicaron([], "corte_completado");

    expect(noAplican).toEqual(
      DISPONIBLES.slice(0, DISPONIBLES.indexOf("corte_completado")),
    );
    expect(noAplican).not.toContain("corte_completado");
  });

  it("no deja marcar una etapa anterior a la de entrada", () => {
    const veredicto = puedeMarcar({
      checkpoint: "cotizacion_enviada",
      marcados: [],
      rol: buscarCheckpoint("cotizacion_enviada").rolDueno,
      etapaInicial: "corte_completado",
    });

    expect(veredicto).toMatchObject({
      permitido: false,
      motivo: "fuera_de_secuencia",
    });
  });

  it("deja marcar la etapa de entrada al rol dueño", () => {
    expect(
      puedeMarcar({
        checkpoint: "corte_completado",
        marcados: [],
        rol: "corte",
        etapaInicial: "corte_completado",
      }),
    ).toEqual({ permitido: true });
  });

  it("después de la etapa de entrada el flujo sigue normal", () => {
    expect(siguienteCheckpoint(["corte_completado"], "corte_completado")).toBe(
      "recogido_bordado",
    );
  });

  it("lo que sigue (a quién le toca) sale de la etapa inicial", () => {
    const sigue = loQueSigue([], "recogido_bordado");

    expect(sigue?.checkpoint.id).toBe("recogido_bordado");
    expect(sigue?.responsable).toBe("Logística");
  });
});

describe("una orden devuelta (solo cuentan los avances vigentes)", () => {
  const ANTES_DEL_CORTE = DISPONIBLES.slice(
    0,
    DISPONIBLES.indexOf("corte_completado"),
  );
  const HASTA_BORDADO = DISPONIBLES.slice(
    0,
    DISPONIBLES.indexOf("recogido_bordado") + 1,
  );

  it("antes de la devolución la siguiente es la llegada a marcación", () => {
    expect(siguienteCheckpoint(HASTA_BORDADO)).toBe("llegada_marcacion");
  });

  it("al devolver al corte, la siguiente vuelve a ser el corte", () => {
    // El corte y el bordado quedaron anulados: el motor solo ve lo anterior.
    expect(siguienteCheckpoint(ANTES_DEL_CORTE)).toBe("corte_completado");
  });

  it("no deja marcar el bordado mientras el corte esté anulado", () => {
    expect(
      puedeMarcar({
        checkpoint: "recogido_bordado",
        marcados: ANTES_DEL_CORTE,
        rol: "logistica",
      }),
    ).toMatchObject({ permitido: false, motivo: "fuera_de_secuencia" });
  });

  it("deja volver a marcar el corte, que antes figuraba como ya marcado", () => {
    expect(
      puedeMarcar({
        checkpoint: "corte_completado",
        marcados: ANTES_DEL_CORTE,
        rol: "corte",
      }),
    ).toEqual({ permitido: true });
  });

  it("las etapas anuladas no se confunden con 'No aplicó'", () => {
    // El corte y el bordado quedaron pendientes, no pasados de largo.
    expect(etapasQueNoAplicaron(ANTES_DEL_CORTE)).toEqual([]);
  });

  it("'No aplicó' sigue funcionando con los avances vigentes", () => {
    // Una orden que se saltó la programación cuando esa etapa no existía.
    const sinProgramacion = ["ficha_adjunta"] as CheckpointId[];
    expect(etapasQueNoAplicaron(sinProgramacion)).toEqual(
      DISPONIBLES.slice(0, DISPONIBLES.indexOf("ficha_adjunta")),
    );
  });
});
