import { describe, expect, it } from "vitest";

import {
  CHECKPOINT_PROGRAMACION,
  MAXIMO_POR_HOJA,
  moverEnLista,
  puedeProgramar,
  ROL_DE_PROGRAMACION,
  totalDePrendas,
  validarHoja,
} from "@/features/programacion/reglas";
import { buscarCheckpoint } from "@/features/workflow/checkpoints";

/**
 * Las reglas de la programación a diseño (HU-03).
 *
 * Lo que se prueba aquí es lo que el motor de workflow no puede saber: si la
 * hoja que armó la secretaria tiene sentido, y cómo se acomodan las órdenes
 * dentro de ella. Que la etapa sea la siguiente de la secuencia y que el rol
 * sea el dueño ya lo prueba `transiciones.test.ts`.
 *
 * El tope sale de la constante y no de un número escrito a mano: cambiarlo no
 * puede poner nada en rojo.
 */

const ORDEN_A = "00000000-0000-0000-0000-0000000000f1";
const ORDEN_B = "00000000-0000-0000-0000-0000000000f8";
const ORDEN_C = "00000000-0000-0000-0000-0000000000f9";

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

describe("validarHoja", () => {
  it("acepta una sola orden", () => {
    expect(validarHoja([ORDEN_A])).toEqual({ valida: true });
  });

  it("acepta una hoja del tamaño del tope", () => {
    const llena = Array.from(
      { length: MAXIMO_POR_HOJA },
      (_, indice) => `orden-${indice}`,
    );

    expect(validarHoja(llena)).toEqual({ valida: true });
  });

  it("rechaza una hoja vacía", () => {
    const resultado = validarHoja([]);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida) expect(resultado.mensaje).toMatch(/al menos una/i);
  });

  it("rechaza pasarse del tope, y dice cuál es", () => {
    const pasada = Array.from(
      { length: MAXIMO_POR_HOJA + 1 },
      (_, indice) => `orden-${indice}`,
    );

    const resultado = validarHoja(pasada);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida) {
      expect(resultado.mensaje).toContain(String(MAXIMO_POR_HOJA));
    }
  });

  it("rechaza la misma orden dos veces", () => {
    const resultado = validarHoja([ORDEN_A, ORDEN_B, ORDEN_A]);

    expect(resultado.valida).toBe(false);
    if (!resultado.valida) expect(resultado.mensaje).toMatch(/dos veces/i);
  });
});

describe("moverEnLista · lo que hacen las flechas", () => {
  const LISTA = [ORDEN_A, ORDEN_B, ORDEN_C];

  it("sube una orden un puesto, intercambiándola con la de arriba", () => {
    expect(moverEnLista(LISTA, 2, "arriba")).toEqual([
      ORDEN_A,
      ORDEN_C,
      ORDEN_B,
    ]);
  });

  it("baja una orden un puesto", () => {
    expect(moverEnLista(LISTA, 0, "abajo")).toEqual([
      ORDEN_B,
      ORDEN_A,
      ORDEN_C,
    ]);
  });

  it("dos toques llevan la tercera al primer puesto", () => {
    const unPaso = moverEnLista(LISTA, 2, "arriba");

    expect(moverEnLista(unPaso, 1, "arriba")).toEqual([
      ORDEN_C,
      ORDEN_A,
      ORDEN_B,
    ]);
  });

  it("subir la primera no la saca de la lista", () => {
    expect(moverEnLista(LISTA, 0, "arriba")).toEqual(LISTA);
  });

  it("bajar la última no la saca de la lista", () => {
    expect(moverEnLista(LISTA, 2, "abajo")).toEqual(LISTA);
  });

  it("no modifica la lista que recibe", () => {
    const original = [...LISTA];
    moverEnLista(original, 0, "abajo");

    expect(original).toEqual(LISTA);
  });

  it("una posición que no existe deja la lista igual", () => {
    expect(moverEnLista(LISTA, 9, "arriba")).toEqual(LISTA);
  });
});

describe("totalDePrendas", () => {
  it("suma las cantidades de las referencias", () => {
    expect(totalDePrendas([{ cantidad: 120 }, { cantidad: 90 }])).toBe(210);
  });

  it("una orden sin referencias no suma nada", () => {
    expect(totalDePrendas([])).toBe(0);
  });
});
