import { describe, expect, it } from "vitest";

import { formatearFecha } from "@/lib/utils/fechas";

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
