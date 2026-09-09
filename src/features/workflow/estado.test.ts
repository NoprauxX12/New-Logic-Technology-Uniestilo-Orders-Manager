import { describe, expect, it } from "vitest";

import {
  CHECKPOINTS,
  ETIQUETAS_ROL,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";

/**
 * Derivación de a quién le toca el siguiente paso.
 *
 * Es lo que sostiene el criterio 3 de HU-19 —"le aparece a secretaría para el
 * cierre"—: nadie escribe "Secretaría" en el código, sale de la fuente única.
 * Los casos se arman desde `CHECKPOINTS`, así que reordenar el flujo los pone
 * en rojo en vez de dejarlos pasar.
 */

const SECUENCIA = CHECKPOINTS.map((checkpoint) => checkpoint.id);

/** Lo marcado por una orden que ya recorrió los primeros `cuantos` pasos. */
function primeros(cuantos: number): CheckpointId[] {
  return SECUENCIA.slice(0, cuantos);
}

/** Cuántos pasos lleva una orden que acaba de marcar `checkpoint`. */
function recorridoHasta(checkpoint: CheckpointId): number {
  return SECUENCIA.indexOf(checkpoint) + 1;
}

describe("loQueSigue · a quién le toca", () => {
  it("una orden recién registrada arranca por el primer paso del flujo", () => {
    const sigue = loQueSigue([]);

    expect(sigue).not.toBeNull();
    if (!sigue) return;
    expect(sigue.checkpoint).toEqual(CHECKPOINTS[0]);
  });

  it("después de marcar lista para despachar el cierre le queda a secretaría", () => {
    const sigue = loQueSigue(primeros(recorridoHasta("lista_despacho")));

    expect(sigue).not.toBeNull();
    if (!sigue) return;
    expect(sigue.checkpoint.id).toBe("cerrada");
    expect(sigue.responsable).toBe(ETIQUETAS_ROL.secretaria);
  });

  it("mientras la orden no llegue a marcación, el siguiente paso es esa llegada", () => {
    const sigue = loQueSigue(primeros(recorridoHasta("recogido_bordado")));

    expect(sigue?.checkpoint.id).toBe("llegada_marcacion");
  });

  it("no depende del orden en que la base devuelva los avances", () => {
    const enOrden = primeros(recorridoHasta("llegada_marcacion"));
    const alReves = [...enOrden].reverse();

    expect(loQueSigue(alReves)).toEqual(loQueSigue(enOrden));
  });

  it("es null cuando la orden ya recorrió todo el flujo", () => {
    expect(loQueSigue(SECUENCIA)).toBeNull();
  });
});
