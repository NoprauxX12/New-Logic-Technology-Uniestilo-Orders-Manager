import { describe, expect, it } from "vitest";

import {
  CHECKPOINTS,
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";
import {
  checkpointsCompletados,
  puedeMarcar,
  siguienteCheckpoint,
} from "@/features/workflow/transiciones";

/**
 * Reglas del motor de workflow. Aquí vive el riesgo del dominio, así que se
 * prueban las tres condiciones por separado y también cuál gana cuando fallan
 * varias a la vez.
 */

/**
 * Todos los valores del enum `checkpoint` de la base, escritos a mano.
 *
 * Es un `Record` a propósito: si alguien agrega un checkpoint en una migración
 * y regenera `database.types.ts`, TypeScript exige completarlo aquí, y el test
 * de abajo exige que también esté en `CHECKPOINTS`. Es la red que mantiene
 * sincronizados la base y la fuente única de la secuencia.
 */
const TODOS: Record<CheckpointId, true> = {
  cotizacion_aprobada: true,
  programada_diseno: true,
  ficha_adjunta: true,
  tela_programada: true,
  corte_completado: true,
  recogido_bordado: true,
  llegada_marcacion: true,
  lista_despacho: true,
  cerrada: true,
};

/** Los ids en el orden del flujo, para armar casos sin repetir literales. */
const SECUENCIA = CHECKPOINTS.map((checkpoint) => checkpoint.id);

/** Los seis roles del modelo, para elegir uno por su relación con otro. */
const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

/** Lo marcado por una orden que ya recorrió los primeros `cuantos` pasos. */
function primeros(cuantos: number): CheckpointId[] {
  return SECUENCIA.slice(0, cuantos);
}

describe("checkpoints · fuente única", () => {
  it("la secuencia cubre exactamente los valores del enum de la base", () => {
    expect([...SECUENCIA].sort()).toEqual(Object.keys(TODOS).sort());
  });

  it("no repite ningún checkpoint", () => {
    expect(new Set(SECUENCIA).size).toBe(SECUENCIA.length);
  });

  it("cada checkpoint tiene un rol dueño conocido", () => {
    for (const { rolDueno } of CHECKPOINTS) {
      expect(ETIQUETAS_ROL[rolDueno]).toBeDefined();
    }
  });
});

describe("siguienteCheckpoint", () => {
  it("en una orden recién registrada es el primero del flujo", () => {
    expect(siguienteCheckpoint([])).toBe(SECUENCIA[0]);
  });

  it("avanza al que sigue a medida que se marcan", () => {
    expect(siguienteCheckpoint(primeros(3))).toBe(SECUENCIA[3]);
  });

  it("no depende del orden en que lleguen los marcados", () => {
    const desordenados = [...primeros(3)].reverse();

    expect(siguienteCheckpoint(desordenados)).toBe(SECUENCIA[3]);
  });

  it("es null cuando la orden ya recorrió todo", () => {
    expect(siguienteCheckpoint(SECUENCIA)).toBeNull();
  });
});

describe("checkpointsCompletados", () => {
  it("cuenta los marcados, ignorando el orden", () => {
    expect(checkpointsCompletados([])).toBe(0);
    expect(checkpointsCompletados(primeros(4))).toBe(4);
    expect(checkpointsCompletados(SECUENCIA)).toBe(SECUENCIA.length);
  });
});

describe("puedeMarcar", () => {
  it("deja marcar el siguiente al rol dueño de esa sección", () => {
    const siguiente = CHECKPOINTS[0];

    const resultado = puedeMarcar({
      checkpoint: siguiente.id,
      marcados: [],
      rol: siguiente.rolDueno,
    });

    expect(resultado.permitido).toBe(true);
  });

  it("no deja marcar dos veces el mismo checkpoint", () => {
    const primero = CHECKPOINTS[0];

    const resultado = puedeMarcar({
      checkpoint: primero.id,
      marcados: [primero.id],
      rol: primero.rolDueno,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("ya_marcado");
  });

  it("no deja saltarse pasos de la secuencia", () => {
    const tercero = CHECKPOINTS[2];

    const resultado = puedeMarcar({
      checkpoint: tercero.id,
      marcados: [],
      rol: tercero.rolDueno,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("fuera_de_secuencia");
    expect(resultado.mensaje).toContain(CHECKPOINTS[0].etiqueta);
  });

  it("no deja marcar a un rol que no es dueño de la sección", () => {
    const corte = CHECKPOINTS.find((c) => c.rolDueno === "corte");
    expect(corte).toBeDefined();
    if (!corte) return;

    const posicion = SECUENCIA.indexOf(corte.id);
    const resultado = puedeMarcar({
      checkpoint: corte.id,
      marcados: primeros(posicion),
      rol: "logistica",
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("rol_no_autorizado");
    expect(resultado.mensaje).toContain(ETIQUETAS_ROL.corte);
  });

  it("avisa que ya está marcado antes que del rol, cuando fallan las dos", () => {
    const primero = CHECKPOINTS[0];
    // Cualquier rol que no sea el dueño. Se busca en vez de escribirlo porque
    // `CHECKPOINTS` es `as const`: TypeScript conoce el rol exacto de este
    // checkpoint y trata como imposible cualquier comparación escrita a mano.
    const otroRol = ROLES.find((rol) => rol !== primero.rolDueno);
    expect(otroRol).toBeDefined();
    if (!otroRol) return;

    const resultado = puedeMarcar({
      checkpoint: primero.id,
      marcados: [primero.id],
      rol: otroRol,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("ya_marcado");
  });

  it("no deja marcar nada cuando la orden ya terminó su recorrido", () => {
    const ultimo = CHECKPOINTS[CHECKPOINTS.length - 1];

    const resultado = puedeMarcar({
      checkpoint: ultimo.id,
      marcados: SECUENCIA,
      rol: ultimo.rolDueno,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("ya_marcado");
  });

  it("recorre el flujo completo si cada rol marca lo suyo en orden", () => {
    const marcados: CheckpointId[] = [];

    for (const checkpoint of CHECKPOINTS) {
      const resultado = puedeMarcar({
        checkpoint: checkpoint.id,
        marcados,
        rol: checkpoint.rolDueno,
      });

      expect(resultado.permitido).toBe(true);
      marcados.push(checkpoint.id);
    }

    expect(siguienteCheckpoint(marcados)).toBeNull();
  });
});
