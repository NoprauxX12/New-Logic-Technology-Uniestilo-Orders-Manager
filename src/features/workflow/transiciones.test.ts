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
 * Los casos se arman a partir de CHECKPOINTS para incluir las etapas
 * que se vayan habilitando.
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

const SECUENCIA = CHECKPOINTS.map((checkpoint) => checkpoint.id);

const DISPONIBLES: CheckpointId[] = CHECKPOINTS_DISPONIBLES.map(
  (checkpoint) => checkpoint.id,
);

const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

/** Una orden que ya recorrió las primeras etapas disponibles. */
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
        recepcionConfirmada: true,
      });

      expect(resultado.permitido).toBe(true);
      marcados.push(checkpoint.id);
    }

    expect(siguienteCheckpoint(marcados)).toBeNull();
  });
});

describe("puedeMarcar · lista para despachar (HU-19)", () => {
  const { rolDueno } = buscarCheckpoint("lista_despacho");
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

describe("puedeMarcar · requisito de recepción del taller (HU-12)", () => {
  const { rolDueno } = buscarCheckpoint("llegada_marcacion");
  const previos = primerasDisponibles(DISPONIBLES.indexOf("llegada_marcacion"));

  it("checkpoints.ts declara que la llegada a marcación exige la recepción", () => {
    expect(buscarCheckpoint("llegada_marcacion").requisito).toBe(
      "recepcion_de_taller",
    );
  });

  it("no deja marcar la llegada mientras logística no confirme la recepción", () => {
    const resultado = puedeMarcar({
      checkpoint: "llegada_marcacion",
      marcados: previos,
      rol: rolDueno,
      recepcionConfirmada: false,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("requisito_pendiente");
    expect(resultado.mensaje).toMatch(/logística.*recepción/i);
  });

  it("deja marcar la llegada cuando la recepción está confirmada", () => {
    const resultado = puedeMarcar({
      checkpoint: "llegada_marcacion",
      marcados: previos,
      rol: rolDueno,
      recepcionConfirmada: true,
    });

    expect(resultado.permitido).toBe(true);
  });

  it("si no se dice nada sobre la recepción, la exige igual", () => {
    const resultado = puedeMarcar({
      checkpoint: "llegada_marcacion",
      marcados: previos,
      rol: rolDueno,
    });

    expect(resultado.permitido).toBe(false);
  });

  it("las etapas sin requisito no se fijan en la recepción", () => {
    const sinRequisito = CHECKPOINTS_DISPONIBLES.find(
      (c) => !("requisito" in c),
    );

    expect(sinRequisito).toBeDefined();
    if (!sinRequisito) return;

    const resultado = puedeMarcar({
      checkpoint: sinRequisito.id,
      marcados: primerasDisponibles(DISPONIBLES.indexOf(sinRequisito.id)),
      rol: sinRequisito.rolDueno,
      recepcionConfirmada: false,
    });

    expect(resultado.permitido).toBe(true);
  });

  it("avisa primero que falta un paso anterior, y después el requisito", () => {
    const resultado = puedeMarcar({
      checkpoint: "llegada_marcacion",
      marcados: [],
      rol: rolDueno,
      recepcionConfirmada: false,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("fuera_de_secuencia");
  });
});

describe("puedeMarcar · requisito de tela en la empresa (HU-22)", () => {
  const { rolDueno } = buscarCheckpoint("corte_completado");
  const previos = primerasDisponibles(DISPONIBLES.indexOf("corte_completado"));

  it("checkpoints.ts declara que el corte exige la tela en la empresa", () => {
    expect(buscarCheckpoint("corte_completado").requisito).toBe(
      "tela_en_empresa",
    );
  });

  it("no deja marcar el corte mientras la orden espera tela, y dice a quién le toca", () => {
    const resultado = puedeMarcar({
      checkpoint: "corte_completado",
      marcados: previos,
      rol: rolDueno,
      esperandoTela: true,
    });

    expect(resultado.permitido).toBe(false);
    if (resultado.permitido) return;
    expect(resultado.motivo).toBe("requisito_pendiente");
    expect(resultado.mensaje).toMatch(/esperando tela.*Secretaría/);
  });

  it("deja marcar el corte cuando la tela ya llegó", () => {
    expect(
      puedeMarcar({
        checkpoint: "corte_completado",
        marcados: previos,
        rol: rolDueno,
        esperandoTela: false,
      }),
    ).toEqual({ permitido: true });
  });

  it("si no se informa, asume que la orden no espera tela", () => {
    expect(
      puedeMarcar({
        checkpoint: "corte_completado",
        marcados: previos,
        rol: rolDueno,
      }),
    ).toEqual({ permitido: true });
  });

  it("esperar tela no frena las demás etapas", () => {
    const previosMarcacion = primerasDisponibles(
      DISPONIBLES.indexOf("llegada_marcacion"),
    );

    expect(
      puedeMarcar({
        checkpoint: "llegada_marcacion",
        marcados: previosMarcacion,
        rol: buscarCheckpoint("llegada_marcacion").rolDueno,
        recepcionConfirmada: true,
        esperandoTela: true,
      }),
    ).toEqual({ permitido: true });
  });

  it("el rol se dice antes que la tela: a corte le toca, aunque falte tela", () => {
    const resultado = puedeMarcar({
      checkpoint: "corte_completado",
      marcados: previos,
      rol: "secretaria",
      esperandoTela: true,
    });

    expect(resultado.permitido === false && resultado.motivo).toBe(
      "rol_no_autorizado",
    );
  });
});

describe("HU-09 · recogido y bordado", () => {
  const previosAlRecogido = primerasDisponibles(
    DISPONIBLES.indexOf("recogido_bordado"),
  );

  it("permite a logística marcar después del corte", () => {
    expect(
      puedeMarcar({
        checkpoint: "recogido_bordado",
        marcados: previosAlRecogido,
        rol: "logistica",
      }),
    ).toEqual({ permitido: true });
  });

  it("impide pasar a marcación sin recogido y bordado", () => {
    const resultado = puedeMarcar({
      checkpoint: "llegada_marcacion",
      marcados: previosAlRecogido,
      rol: "marcacion",
      recepcionConfirmada: true,
    });

    expect(resultado).toMatchObject({
      permitido: false,
      motivo: "fuera_de_secuencia",
    });

    if (resultado.permitido) return;

    expect(resultado.mensaje).toContain(
      buscarCheckpoint("recogido_bordado").etiqueta,
    );
  });
});
