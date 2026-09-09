import { describe, expect, it } from "vitest";

import { CHECKPOINTS } from "@/features/workflow/checkpoints";
import { marcarAvanceSchema } from "@/features/workflow/schemas";

/**
 * Lo que entra a la action de marcado.
 *
 * No se prueba que el paso sea el correcto en la secuencia ni que el rol pueda
 * marcarlo: eso lo decide el motor (`transiciones.ts`) con los avances que la
 * orden tiene en la base. Aquí solo se verifica la forma de lo que llega, que
 * es la primera barrera contra un POST directo a la Server Action.
 */

/** OC-5005 del seed: la orden que espera justamente este marcado. */
const ORDEN_ID = "00000000-0000-0000-0000-0000000000f5";

describe("marcarAvanceSchema · lo que entra a la action", () => {
  it("acepta el id de una orden del seed, que no es un uuid de la RFC", () => {
    const resultado = marcarAvanceSchema.safeParse({
      ordenId: ORDEN_ID,
      checkpoint: "lista_despacho",
    });

    expect(resultado.success).toBe(true);
  });

  it("acepta el id de una orden creada por la base", () => {
    const resultado = marcarAvanceSchema.safeParse({
      ordenId: crypto.randomUUID(),
      checkpoint: "lista_despacho",
    });

    expect(resultado.success).toBe(true);
  });

  it("acepta todos los pasos de la secuencia", () => {
    for (const checkpoint of CHECKPOINTS) {
      const resultado = marcarAvanceSchema.safeParse({
        ordenId: ORDEN_ID,
        checkpoint: checkpoint.id,
      });

      expect(resultado.success).toBe(true);
    }
  });

  it("rechaza un paso del proceso que no existe", () => {
    const resultado = marcarAvanceSchema.safeParse({
      ordenId: ORDEN_ID,
      checkpoint: "planchado",
    });

    expect(resultado.success).toBe(false);
  });

  it("rechaza una orden que no viene identificada por un uuid", () => {
    const resultado = marcarAvanceSchema.safeParse({
      ordenId: "OC-5005",
      checkpoint: "lista_despacho",
    });

    expect(resultado.success).toBe(false);
  });

  it("rechaza un formulario que llega sin datos", () => {
    const resultado = marcarAvanceSchema.safeParse({
      ordenId: null,
      checkpoint: null,
    });

    expect(resultado.success).toBe(false);
  });
});
