import { describe, expect, it } from "vitest";

import {
  buscarCheckpoint,
  CHECKPOINTS,
  CHECKPOINTS_DISPONIBLES,
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
 * prueban las condiciones por separado y también cuál gana cuando fallan
 * varias a la vez.
 *
 * Los casos se arman a partir de `CHECKPOINTS`, no de valores escritos a mano,
 * para que sigan valiendo cuando una historia de otro sprint ponga su etapa
 * como disponible.
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
  etiquetas: true,
  documentos_despacho: true,
  factura_generada: true,
  cerrada: true,
};

/** La secuencia completa del flujo del taller. */
const SECUENCIA = CHECKPOINTS.map((checkpoint) => checkpoint.id);

/**
 * Lo que hoy se puede marcar, en el orden del flujo.
 *
 * Se anota como `CheckpointId[]` a propósito: TypeScript deduce de
 * `CHECKPOINTS_DISPONIBLES` el subconjunto exacto de etapas disponibles, y sin
 * ensanchar aquí no dejaría preguntar si una etapa cualquiera está en la lista.
 */
const DISPONIBLES: CheckpointId[] = CHECKPOINTS_DISPONIBLES.map(
  (checkpoint) => checkpoint.id,
);

/** Los seis roles del modelo, para elegir uno por su relación con otro. */
const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

/** Una orden que ya recorrió las primeras `cuantas` etapas disponibles. */
function primerasDisponibles(cuantas: number): CheckpointId[] {
  return DISPONIBLES.slice(0, cuantas);
}

describe("checkpoints · fuente única", () => {
  it("la secuencia cubre exactamente los valores del enum de la base", () => {
    expect([...SECUENCIA].sort()).toEqual(Object.keys(TODOS).sort());
  });

  it("no repite ningún checkpoint", () => {
    expect(new Set(SECUENCIA).size).toBe(SECUENCIA.length);
  });

  it("cada checkpoint tiene un rol dueño conocido y su HU", () => {
    for (const { rolDueno, hu } of CHECKPOINTS) {
      expect(ETIQUETAS_ROL[rolDueno]).toBeDefined();
      expect(hu).toMatch(/^HU-\d+$/);
    }
  });

  it("las disponibles son un subconjunto, en el mismo orden del flujo", () => {
    const enOrden = SECUENCIA.filter((id) => DISPONIBLES.includes(id));

    expect(DISPONIBLES).toEqual(enOrden);
    expect(DISPONIBLES.length).toBeGreaterThan(0);
  });
});

describe("siguienteCheckpoint", () => {
  it("en una orden recién registrada es la primera etapa disponible", () => {
    expect(siguienteCheckpoint([])).toBe(DISPONIBLES[0]);
  });

  it("nunca propone una etapa que todavía no tiene pantalla", () => {
    const sinPantalla = CHECKPOINTS.filter((c) => !c.disponible).map(
      (c) => c.id,
    );

    expect(sinPantalla).not.toContain(siguienteCheckpoint([]));
  });

  it("avanza a la que sigue a medida que se marcan", () => {
    expect(siguienteCheckpoint(primerasDisponibles(1))).toBe(DISPONIBLES[1]);
  });

  it("no depende del orden en que lleguen los marcados", () => {
    const desordenados = [...primerasDisponibles(2)].reverse();

    expect(siguienteCheckpoint(desordenados)).toBe(DISPONIBLES[2]);
  });

  it("es null cuando ya se marcó todo lo que hoy se puede marcar", () => {
    expect(siguienteCheckpoint(DISPONIBLES)).toBeNull();
  });
});

describe("checkpointsCompletados", () => {
  it("cuenta los marcados, ignorando el orden", () => {
    expect(checkpointsCompletados([])).toBe(0);
    expect(checkpointsCompletados(SECUENCIA)).toBe(SECUENCIA.length);
  });

  it("cuenta también las etapas que vienen marcadas de otros sprints", () => {
    const sinPantalla = CHECKPOINTS.filter((c) => !c.disponible).map(
      (c) => c.id,
    );

    expect(checkpointsCompletados(sinPantalla)).toBe(sinPantalla.length);
  });
});

describe("puedeMarcar", () => {
  it("deja marcar la siguiente al rol dueño de esa sección", () => {
    const siguiente = CHECKPOINTS_DISPONIBLES[0];

    const resultado = puedeMarcar({
      checkpoint: siguiente.id,
      marcados: [],
      rol: siguiente.rolDueno,
    });

    expect(resultado.permitido).toBe(true);
  });

  it("no deja marcar dos veces el mismo checkpoint", () => {
    const primero = CHECKPOINTS_DISPONIBLES[0];

    const resultado = puedeMarcar({
      checkpoint: primero.id,
      marcados: [primero.id],
      rol: primero.rolDueno,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("ya_marcado");
  });

  it("no deja marcar una etapa que todavía no tiene pantalla", () => {
    const sinPantalla = CHECKPOINTS.find((c) => !c.disponible);
    // Cuando el Sprint 3 construya la última, este caso deja de existir.
    if (!sinPantalla) return;

    const resultado = puedeMarcar({
      checkpoint: sinPantalla.id,
      marcados: [],
      rol: sinPantalla.rolDueno,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("todavia_no_disponible");
  });

  it("no deja saltarse pasos de la secuencia", () => {
    const tercera = CHECKPOINTS_DISPONIBLES[2];

    const resultado = puedeMarcar({
      checkpoint: tercera.id,
      marcados: [],
      rol: tercera.rolDueno,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("fuera_de_secuencia");
    expect(resultado.mensaje).toContain(CHECKPOINTS_DISPONIBLES[0].etiqueta);
  });

  it("no deja marcar a un rol que no es dueño de la sección", () => {
    const primera = CHECKPOINTS_DISPONIBLES[0];
    const otroRol = ROLES.find((rol) => rol !== primera.rolDueno);
    expect(otroRol).toBeDefined();
    if (!otroRol) return;

    const resultado = puedeMarcar({
      checkpoint: primera.id,
      marcados: [],
      rol: otroRol,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("rol_no_autorizado");
    expect(resultado.mensaje).toContain(ETIQUETAS_ROL[primera.rolDueno]);
  });

  it("avisa que ya está marcado antes que del rol, cuando fallan las dos", () => {
    const primera = CHECKPOINTS_DISPONIBLES[0];
    // Cualquier rol que no sea el dueño. Se busca en vez de escribirlo porque
    // `CHECKPOINTS` es `as const`: TypeScript conoce el rol exacto de esta
    // etapa y trata como imposible cualquier comparación escrita a mano.
    const otroRol = ROLES.find((rol) => rol !== primera.rolDueno);
    expect(otroRol).toBeDefined();
    if (!otroRol) return;

    const resultado = puedeMarcar({
      checkpoint: primera.id,
      marcados: [primera.id],
      rol: otroRol,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("ya_marcado");
  });

  it("recorre el flujo disponible si cada rol marca lo suyo en orden", () => {
    const marcados: CheckpointId[] = [];

    for (const checkpoint of CHECKPOINTS_DISPONIBLES) {
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

/**
 * Los casos de arriba prueban las reglas del motor con un checkpoint cualquiera.
 * Estos prueban la posición concreta de `lista_despacho` en la secuencia, que es
 * el criterio 2 de HU-19: "solo está disponible si la orden ya pasó por
 * marcación". Si alguien reordena `CHECKPOINTS`, los genéricos siguen en verde
 * y estos dos no.
 */
describe("puedeMarcar · lista para despachar (HU-19)", () => {
  const { rolDueno } = buscarCheckpoint("lista_despacho");
  // Se cuenta sobre las etapas disponibles, que es lo que mira el motor: las
  // que todavía no tienen pantalla no se exigen.
  const pasosPrevios = DISPONIBLES.indexOf("lista_despacho");

  it("no se puede marcar mientras la orden no haya llegado a marcación", () => {
    const resultado = puedeMarcar({
      checkpoint: "lista_despacho",
      marcados: primerasDisponibles(pasosPrevios - 1),
      rol: rolDueno,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("fuera_de_secuencia");
    expect(resultado.mensaje).toContain(
      buscarCheckpoint("llegada_marcacion").etiqueta,
    );
  });

  it("se puede marcar apenas la orden llega a marcación", () => {
    const resultado = puedeMarcar({
      checkpoint: "lista_despacho",
      marcados: primerasDisponibles(pasosPrevios),
      rol: rolDueno,
    });

    expect(resultado.permitido).toBe(true);
  });
});
