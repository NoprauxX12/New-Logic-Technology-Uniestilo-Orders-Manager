import { describe, expect, it } from "vitest";

import {
  erroresPorOrden,
  leerFormularioProgramacion,
} from "@/features/programacion/formulario";
import { programarOrdenesSchema } from "@/features/programacion/schemas";

/**
 * Lo que entra a programar (HU-03): primero la lectura del formulario, después
 * el esquema. Las dos cosas se prueban juntas porque es el mismo recorrido: lo
 * que el navegador manda tiene que llegar al esquema con la forma que espera.
 */

const ORDEN_A = "00000000-0000-0000-0000-0000000000f1";
const ORDEN_B = "00000000-0000-0000-0000-0000000000f8";

function formularioCon(filas: { ordenId: string; numero: string }[]): FormData {
  const formData = new FormData();
  for (const fila of filas) {
    formData.append("ordenId", fila.ordenId);
    formData.append("numeroOrdenProgramacion", fila.numero);
  }
  return formData;
}

describe("leerFormularioProgramacion", () => {
  it("empareja cada orden con su número en el orden del formulario", () => {
    const entrada = leerFormularioProgramacion(
      formularioCon([
        { ordenId: ORDEN_A, numero: "PR-104" },
        { ordenId: ORDEN_B, numero: "PR-105" },
      ]),
    );

    expect(entrada.programaciones).toEqual([
      { ordenId: ORDEN_A, numeroOrdenProgramacion: "PR-104" },
      { ordenId: ORDEN_B, numeroOrdenProgramacion: "PR-105" },
    ]);
  });

  it("un formulario sin órdenes agregadas llega como lista vacía", () => {
    expect(
      leerFormularioProgramacion(new FormData()).programaciones,
    ).toHaveLength(0);
  });

  it("una orden sin su número no desalinea las demás", () => {
    const formData = new FormData();
    formData.append("ordenId", ORDEN_A);

    const entrada = leerFormularioProgramacion(formData);

    expect(entrada.programaciones).toEqual([
      { ordenId: ORDEN_A, numeroOrdenProgramacion: "" },
    ]);
  });
});

describe("programarOrdenesSchema", () => {
  it("acepta una lista con una sola orden", () => {
    const resultado = programarOrdenesSchema.safeParse({
      programaciones: [{ ordenId: ORDEN_A, numeroOrdenProgramacion: "PR-104" }],
    });

    expect(resultado.success).toBe(true);
  });

  it("recorta los espacios del número", () => {
    const resultado = programarOrdenesSchema.safeParse({
      programaciones: [
        { ordenId: ORDEN_A, numeroOrdenProgramacion: "  PR-104  " },
      ],
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.programaciones[0].numeroOrdenProgramacion).toBe(
        "PR-104",
      );
    }
  });

  it("no acepta una lista vacía", () => {
    const resultado = programarOrdenesSchema.safeParse({ programaciones: [] });

    expect(resultado.success).toBe(false);
  });

  it("no acepta una orden sin número", () => {
    const resultado = programarOrdenesSchema.safeParse({
      programaciones: [{ ordenId: ORDEN_A, numeroOrdenProgramacion: "   " }],
    });

    expect(resultado.success).toBe(false);
  });

  it("no acepta un número larguísimo", () => {
    const resultado = programarOrdenesSchema.safeParse({
      programaciones: [
        { ordenId: ORDEN_A, numeroOrdenProgramacion: "P".repeat(31) },
      ],
    });

    expect(resultado.success).toBe(false);
  });

  it("acepta los ids del seed, que no son UUID de la RFC", () => {
    const resultado = programarOrdenesSchema.safeParse({
      programaciones: [{ ordenId: ORDEN_A, numeroOrdenProgramacion: "PR-104" }],
    });

    expect(resultado.success).toBe(true);
  });

  it("rechaza un id que no es un identificador", () => {
    const resultado = programarOrdenesSchema.safeParse({
      programaciones: [
        { ordenId: "la-primera", numeroOrdenProgramacion: "PR-104" },
      ],
    });

    expect(resultado.success).toBe(false);
  });
});

describe("erroresPorOrden", () => {
  it("deja el error junto a la orden que lo causó", () => {
    const entrada = leerFormularioProgramacion(
      formularioCon([
        { ordenId: ORDEN_A, numero: "PR-104" },
        { ordenId: ORDEN_B, numero: "" },
      ]),
    );

    const resultado = programarOrdenesSchema.safeParse(entrada);
    expect(resultado.success).toBe(false);

    if (!resultado.success) {
      const errores = erroresPorOrden(resultado.error, entrada);

      expect(errores[ORDEN_B]?.[0]).toMatch(/número de programación/i);
      expect(errores[ORDEN_A]).toBeUndefined();
    }
  });

  it("lo que no es de ninguna orden queda bajo la clave de la lista", () => {
    const entrada = { programaciones: [] };
    const resultado = programarOrdenesSchema.safeParse(entrada);

    expect(resultado.success).toBe(false);

    if (!resultado.success) {
      expect(erroresPorOrden(resultado.error, entrada).lista?.[0]).toMatch(
        /al menos una/i,
      );
    }
  });
});
