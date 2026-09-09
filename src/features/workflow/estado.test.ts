import { describe, expect, it } from "vitest";

import {
  CHECKPOINTS_DISPONIBLES,
  ETIQUETAS_ROL,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";

/**
 * Derivación de a quién le toca el siguiente paso.
 *
 * Es lo que sostiene el criterio 3 de HU-19 —"le aparece a secretaría para el
 * cierre"—: nadie escribe "Secretaría" en el código, sale de la fuente única.
 *
 * Los casos se arman sobre `CHECKPOINTS_DISPONIBLES` y no sobre las nueve
 * etapas, porque es lo que mira el motor: las que todavía no tienen pantalla se
 * saltan. Así, cuando una historia de otro sprint construya la suya y la ponga
 * disponible, estos casos siguen describiendo la regla y no una foto del
 * sprint actual.
 */

const DISPONIBLES: CheckpointId[] = CHECKPOINTS_DISPONIBLES.map(
  (checkpoint) => checkpoint.id,
);

/** Lo marcado por una orden que recorrió las primeras `cuantas` disponibles. */
function primerasDisponibles(cuantas: number): CheckpointId[] {
  return DISPONIBLES.slice(0, cuantas);
}

/** Cuántas disponibles lleva una orden que acaba de marcar `checkpoint`. */
function recorridoHasta(checkpoint: CheckpointId): number {
  return DISPONIBLES.indexOf(checkpoint) + 1;
}

describe("loQueSigue · a quién le toca", () => {
  it("una orden recién registrada arranca por la primera etapa que ya tiene pantalla", () => {
    const sigue = loQueSigue([]);

    expect(sigue).not.toBeNull();
    if (!sigue) return;
    expect(sigue.checkpoint).toEqual(CHECKPOINTS_DISPONIBLES[0]);
  });

  it("después de marcar lista para despachar el cierre le queda a secretaría", () => {
    const sigue = loQueSigue(
      primerasDisponibles(recorridoHasta("lista_despacho")),
    );

    expect(sigue).not.toBeNull();
    if (!sigue) return;
    expect(sigue.checkpoint.id).toBe("cerrada");
    expect(sigue.responsable).toBe(ETIQUETAS_ROL.secretaria);
  });

  it("mientras la orden no llegue a marcación, el siguiente paso es esa llegada", () => {
    const antesDeMarcacion = DISPONIBLES.indexOf("llegada_marcacion");
    const sigue = loQueSigue(primerasDisponibles(antesDeMarcacion));

    expect(sigue?.checkpoint.id).toBe("llegada_marcacion");
  });

  it("no depende del orden en que la base devuelva los avances", () => {
    const enOrden = primerasDisponibles(recorridoHasta("llegada_marcacion"));
    const alReves = [...enOrden].reverse();

    expect(loQueSigue(alReves)).toEqual(loQueSigue(enOrden));
  });

  it("es null cuando la orden ya recorrió todo lo que hoy se puede marcar", () => {
    expect(loQueSigue(DISPONIBLES)).toBeNull();
  });
});
