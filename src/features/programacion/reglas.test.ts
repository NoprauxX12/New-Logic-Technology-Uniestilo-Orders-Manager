import { describe, expect, it } from "vitest";

import {
  CHECKPOINT_PROGRAMACION,
  numeroNormalizado,
  puedeProgramar,
  ROL_DE_PROGRAMACION,
  totalDePrendas,
  validarLista,
  type OrdenProgramada,
} from "@/features/programacion/reglas";
import { buscarCheckpoint } from "@/features/workflow/checkpoints";

/**
 * Las reglas de la programación a diseño (HU-03).
 *
 * Lo que se prueba aquí es lo que el motor de workflow no puede saber: si la
 * lista que armó la secretaria tiene sentido. Que la etapa sea la siguiente de
 * la secuencia y que el rol sea el dueño ya lo prueba `transiciones.test.ts`;
 * aquí solo se comprueba que esta historia le pregunte.
 */

function fila(ordenId: string, numero: string): OrdenProgramada {
  return { ordenId, numeroOrdenProgramacion: numero };
}

const ORDEN_A = "00000000-0000-0000-0000-0000000000f1";
const ORDEN_B = "00000000-0000-0000-0000-0000000000f8";

describe("la etapa y el rol salen de checkpoints.ts", () => {
  it("programa la etapa de programada a diseño", () => {
    expect(CHECKPOINT_PROGRAMACION).toBe("programada_diseno");
  });

  it("el rol dueño es el que declara la fuente única", () => {
    expect(ROL_DE_PROGRAMACION).toBe(
      buscarCheckpoint(CHECKPOINT_PROGRAMACION).rolDueno,
    );
  });

  it("la etapa ya tiene pantalla, así que el motor la exige", () => {
    const checkpoint = buscarCheckpoint(CHECKPOINT_PROGRAMACION);

    expect(checkpoint.disponible).toBe(true);
    expect(checkpoint.ruta).toBe("/ordenes/programacion");
  });
});

describe("puedeProgramar · le pregunta al motor", () => {
  it("deja programar una orden recién registrada", () => {
    expect(puedeProgramar([], "secretaria")).toEqual({ permitido: true });
  });

  it("no deja programar dos veces la misma orden", () => {
    const veredicto = puedeProgramar(["programada_diseno"], "secretaria");

    expect(veredicto.permitido).toBe(false);
    if (!veredicto.permitido) expect(veredicto.motivo).toBe("ya_marcado");
  });

  it("no deja programar a quien no es secretaría", () => {
    const veredicto = puedeProgramar([], "corte");

    expect(veredicto.permitido).toBe(false);
    if (!veredicto.permitido)
      expect(veredicto.motivo).toBe("rol_no_autorizado");
  });
});

describe("numeroNormalizado", () => {
  it("ignora espacios de más y mayúsculas, como el índice de la base", () => {
    expect(numeroNormalizado("  pr-104 ")).toBe("PR-104");
  });
});

describe("validarLista · sin tope de órdenes", () => {
  it("acepta una sola orden", () => {
    expect(validarLista([fila(ORDEN_A, "PR-104")])).toEqual({ valida: true });
  });

  it("acepta ocho órdenes: cinco o seis era un ejemplo, no un límite", () => {
    const lista = Array.from({ length: 8 }, (_, indice) =>
      fila(`00000000-0000-0000-0000-00000000000${indice}`, `PR-20${indice}`),
    );

    expect(validarLista(lista)).toEqual({ valida: true });
  });

  it("rechaza una lista vacía", () => {
    const resultado = validarLista([]);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida) expect(resultado.mensaje).toMatch(/al menos una/i);
  });

  it("rechaza la misma orden dos veces", () => {
    const resultado = validarLista([
      fila(ORDEN_A, "PR-104"),
      fila(ORDEN_A, "PR-105"),
    ]);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida) expect(resultado.mensaje).toMatch(/dos veces/i);
  });

  it("rechaza una orden sin número de programación", () => {
    const resultado = validarLista([
      fila(ORDEN_A, "PR-104"),
      fila(ORDEN_B, "   "),
    ]);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida)
      expect(resultado.mensaje).toMatch(/falta el número/i);
  });

  it("rechaza dos órdenes con el mismo número, aunque esté escrito distinto", () => {
    const resultado = validarLista([
      fila(ORDEN_A, "PR-104"),
      fila(ORDEN_B, " pr-104"),
    ]);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida) expect(resultado.mensaje).toMatch(/repetido/i);
  });
});

describe("totalDePrendas", () => {
  it("suma las cantidades de las referencias de la orden", () => {
    expect(totalDePrendas([{ cantidad: 120 }, { cantidad: 90 }])).toBe(210);
  });

  it("una orden sin referencias no suma nada", () => {
    expect(totalDePrendas([])).toBe(0);
  });
});
