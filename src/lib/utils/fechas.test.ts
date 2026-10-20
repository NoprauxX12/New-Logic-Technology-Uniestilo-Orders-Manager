import { describe, expect, it } from "vitest";

import { formatearDia, formatearFecha } from "@/lib/utils/fechas";

/**
 * Las fechas de la base llegan como `2026-09-09` y se muestran como
 * `09/09/2026`. Se parten a mano y no con `new Date()`, que las leería en UTC
 * y en Colombia correría el día hacia atrás.
 */
describe("formatearFecha", () => {
  it("pasa una fecha ISO a día/mes/año", () => {
    expect(formatearFecha("2026-09-09")).toBe("09/09/2026");
  });

  it("no corre el día aunque sea el primero del mes", () => {
    expect(formatearFecha("2026-10-01")).toBe("01/10/2026");
  });
});

/**
 * Los instantes de la bitácora sí llevan hora, y en UTC. Se convierten a la
 * hora de Colombia para que el día que se muestra sea el día en que la persona
 * marcó, no el que le tocaba en Greenwich.
 */
describe("formatearDia", () => {
  it("muestra el día del instante en día/mes/año", () => {
    expect(formatearDia("2026-09-09T15:30:00+00:00")).toBe("09/09/2026");
  });

  it("devuelve el día del taller cuando en UTC ya es el siguiente", () => {
    // Medianoche y diez en UTC son las siete y diez de la noche anterior aquí.
    expect(formatearDia("2026-09-16T00:00:10.999064+00:00")).toBe("15/09/2026");
  });

  it("no se le adelanta al día cuando el instante viene sin zona", () => {
    expect(formatearDia("2026-10-01T12:00:00Z")).toBe("01/10/2026");
  });
});
