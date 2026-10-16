import { describe, expect, it } from "vitest";

import { leerFormularioProgramacion } from "@/features/programacion/formulario";
import { MAXIMO_POR_HOJA } from "@/features/programacion/reglas";
import { programarOrdenesSchema } from "@/features/programacion/schemas";

/**
 * Lo que entra a programar (HU-03): primero la lectura del formulario y
 * después el esquema. Se prueban juntos porque es el mismo recorrido: lo que el
 * navegador manda tiene que llegar al esquema con la forma que espera, y en el
 * orden en que la secretaria dejó la hoja.
 */

const ORDEN_A = "00000000-0000-0000-0000-0000000000f1";
const ORDEN_B = "00000000-0000-0000-0000-0000000000f8";

function formularioCon(ordenes: string[]): FormData {
  const formData = new FormData();
  for (const ordenId of ordenes) formData.append("ordenId", ordenId);
  return formData;
}

describe("leerFormularioProgramacion", () => {
  it("conserva el orden en que vienen las órdenes", () => {
    const entrada = leerFormularioProgramacion(
      formularioCon([ORDEN_B, ORDEN_A]),
    );

    expect(entrada.ordenes).toEqual([ORDEN_B, ORDEN_A]);
  });

  it("un formulario sin órdenes agregadas llega como lista vacía", () => {
    expect(leerFormularioProgramacion(new FormData()).ordenes).toHaveLength(0);
  });
});

describe("programarOrdenesSchema", () => {
  it("acepta una hoja con una sola orden", () => {
    expect(
      programarOrdenesSchema.safeParse({ ordenes: [ORDEN_A] }).success,
    ).toBe(true);
  });

  it("acepta los ids del seed, que no son UUID de la RFC", () => {
    expect(
      programarOrdenesSchema.safeParse({ ordenes: [ORDEN_A, ORDEN_B] }).success,
    ).toBe(true);
  });

  it("no acepta una hoja vacía", () => {
    expect(programarOrdenesSchema.safeParse({ ordenes: [] }).success).toBe(
      false,
    );
  });

  it("acepta justo el tope de órdenes", () => {
    const llena = Array.from({ length: MAXIMO_POR_HOJA }, () => ORDEN_A);

    expect(programarOrdenesSchema.safeParse({ ordenes: llena }).success).toBe(
      true,
    );
  });

  it("no acepta más del tope", () => {
    const pasada = Array.from({ length: MAXIMO_POR_HOJA + 1 }, () => ORDEN_A);

    expect(programarOrdenesSchema.safeParse({ ordenes: pasada }).success).toBe(
      false,
    );
  });

  it("rechaza un id que no es un identificador", () => {
    const resultado = programarOrdenesSchema.safeParse({
      ordenes: [ORDEN_A, "la-primera"],
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0].message).toMatch(/identificar/i);
    }
  });
});
