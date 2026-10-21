import { describe, expect, it } from "vitest";

import {
  CHECKPOINTS,
  CHECKPOINTS_DISPONIBLES,
} from "@/features/workflow/checkpoints";
import {
  DIAS_EN_RIESGO,
  armarEtapas,
  contarProgreso,
  derivarSemaforo,
  describirQuienMarco,
  diasHasta,
  etapaDevuelta,
  resumirTablero,
} from "@/lib/ordenes/reglas";
import type { AvanceSeccion, OrdenEnTablero } from "@/lib/ordenes/types";

/** Fecha fija para que los tests no dependan del reloj del PC. */
const AHORA = new Date("2026-09-06T17:00:00Z");

function ordenStub(
  parcial: Pick<
    OrdenEnTablero,
    "semaforo" | "etapasCompletadas" | "etapasTotales"
  > &
    Partial<OrdenEnTablero>,
): OrdenEnTablero {
  return {
    id: "x",
    numeroOrdenCompra: "OC-X",
    razonSocial: "Cliente",
    prenda: "Prenda",
    cantidad: 1,
    fechaRecepcion: "2026-09-01",
    fechaEntrega: "2026-09-30",
    tallerNombre: null,
    estadoTalleres: "Todavía no ha salido a ningún taller.",
    lotesEnTaller: 0,
    tieneFicha: false,
    etapaInicial: null,
    ordenOriginal: null,
    correcciones: [],
    devoluciones: [],
    etapas: [],
    ...parcial,
  };
}

describe("diasHasta", () => {
  it("devuelve negativo si la entrega ya pasó", () => {
    expect(diasHasta("2026-09-05", AHORA)).toBe(-1);
  });

  it("cuenta días de calendario hasta la entrega", () => {
    expect(diasHasta("2026-09-06", AHORA)).toBe(0);
    expect(diasHasta("2026-09-09", AHORA)).toBe(3);
    expect(diasHasta("2026-09-10", AHORA)).toBe(4);
  });
});

describe("diasHasta · el día es el de Bogotá", () => {
  // 21 oct 2026, 8:30 p. m. en Marinilla (UTC-5) son las 01:30 UTC del día 22.
  const NOCHE_EN_MARINILLA = new Date("2026-10-22T01:30:00Z");

  it("a las 8 p. m. en Colombia una orden que vence hoy sigue entregando hoy", () => {
    expect(diasHasta("2026-10-21", NOCHE_EN_MARINILLA)).toBe(0);
    expect(derivarSemaforo("2026-10-21", NOCHE_EN_MARINILLA)).toBe("en_riesgo");
  });

  it("la de ayer sí está atrasada y la de mañana falta un día", () => {
    expect(diasHasta("2026-10-20", NOCHE_EN_MARINILLA)).toBe(-1);
    expect(diasHasta("2026-10-22", NOCHE_EN_MARINILLA)).toBe(1);
  });

  it("pasada la medianoche de Colombia (05:00 UTC) ya es el día siguiente", () => {
    expect(diasHasta("2026-10-21", new Date("2026-10-22T05:00:00Z"))).toBe(-1);
    expect(diasHasta("2026-10-21", new Date("2026-10-22T04:59:00Z"))).toBe(0);
  });
});

describe("derivarSemaforo", () => {
  it("una orden cerrada es entregada: ni atrasada ni en riesgo, tenga la fecha que tenga", () => {
    expect(derivarSemaforo("2026-09-01", AHORA, true)).toBe("entregada");
    expect(derivarSemaforo("2026-09-07", AHORA, true)).toBe("entregada");
    expect(derivarSemaforo("2026-12-01", AHORA, true)).toBe("entregada");
  });

  it("marca atrasada si la fecha de entrega ya pasó", () => {
    expect(derivarSemaforo("2026-09-05", AHORA)).toBe("atrasada");
  });

  it("marca en_riesgo si faltan DIAS_EN_RIESGO o menos (incluye hoy)", () => {
    expect(DIAS_EN_RIESGO).toBe(3);
    expect(derivarSemaforo("2026-09-06", AHORA)).toBe("en_riesgo");
    expect(derivarSemaforo("2026-09-09", AHORA)).toBe("en_riesgo");
  });

  it("marca a_tiempo si faltan más de DIAS_EN_RIESGO", () => {
    expect(derivarSemaforo("2026-09-10", AHORA)).toBe("a_tiempo");
  });
});

describe("armarEtapas", () => {
  it("crea una etapa por cada checkpoint, todas pendientes sin avances", () => {
    const etapas = armarEtapas([]);

    expect(etapas).toHaveLength(CHECKPOINTS.length);
    expect(etapas.every((e) => e.estado === "pendiente")).toBe(true);
    expect(etapas.every((e) => e.avance === null)).toBe(true);
  });

  it("marca completada solo las secciones con avance y conserva quién/cuándo", () => {
    const avances: AvanceSeccion[] = [
      {
        seccion: "cotizacion_aprobada",
        usuarioId: "u1",
        usuarioNombre: "Laura Secretaría",
        fechaHora: "2026-09-01T09:00:00",
      },
      {
        seccion: "programada_diseno",
        usuarioId: "u1",
        usuarioNombre: "Laura Secretaría",
        fechaHora: "2026-09-01T15:00:00",
      },
    ];

    const etapas = armarEtapas(avances);
    const cotizacion = etapas.find((e) => e.seccion === "cotizacion_aprobada");
    const ficha = etapas.find((e) => e.seccion === "ficha_adjunta");

    expect(cotizacion?.estado).toBe("completada");
    expect(cotizacion?.avance?.usuarioNombre).toBe("Laura Secretaría");
    expect(cotizacion?.avance?.fechaHora).toBe("2026-09-01T09:00:00");
    expect(ficha?.estado).toBe("pendiente");
    expect(ficha?.avance).toBeNull();
  });

  it("no deja ambigüedad: cada etapa es completada o pendiente", () => {
    const etapas = armarEtapas([
      {
        seccion: "cotizacion_enviada",
        usuarioId: "u1",
        usuarioNombre: "Laura",
        fechaHora: "2026-09-01T08:00:00",
      },
      {
        seccion: "cotizacion_aprobada",
        usuarioId: "u1",
        usuarioNombre: "Laura",
        fechaHora: "2026-09-01T09:00:00",
      },
    ]);

    for (const etapa of etapas) {
      expect(["completada", "pendiente"]).toContain(etapa.estado);
    }
  });
});

describe("resumirTablero", () => {
  it("cuenta totales, atrasadas, en riesgo y en producción", () => {
    const resumen = resumirTablero([
      ordenStub({
        semaforo: "atrasada",
        etapasCompletadas: 6,
        etapasTotales: 9,
      }),
      ordenStub({
        semaforo: "en_riesgo",
        etapasCompletadas: 2,
        etapasTotales: 9,
      }),
      ordenStub({
        semaforo: "a_tiempo",
        etapasCompletadas: 0,
        etapasTotales: 9,
      }),
      ordenStub({
        semaforo: "a_tiempo",
        etapasCompletadas: 9,
        etapasTotales: 9,
      }),
    ]);

    expect(resumen).toEqual({
      totalOrdenes: 4,
      enProduccion: 2, // 6/9 y 2/9; no 0/9 ni 9/9
      atrasadas: 1,
      enRiesgo: 1,
    });
  });

  it("devuelve ceros si no hay órdenes", () => {
    expect(resumirTablero([])).toEqual({
      totalOrdenes: 0,
      enProduccion: 0,
      atrasadas: 0,
      enRiesgo: 0,
    });
  });
});

describe("contarProgreso", () => {
  it("cuenta solo las etapas que hoy se pueden marcar, para que una orden terminada llegue al 100 %", () => {
    const etapas = armarEtapas(
      CHECKPOINTS_DISPONIBLES.map((checkpoint) => ({
        seccion: checkpoint.id,
        usuarioId: "u1",
        usuarioNombre: "Alguien",
        fechaHora: "2026-09-01T09:00:00",
      })),
    );

    expect(contarProgreso(etapas)).toEqual({
      completadas: CHECKPOINTS_DISPONIBLES.length,
      totales: CHECKPOINTS_DISPONIBLES.length,
    });
  });

  it("no cuenta como pendiente una etapa que todavía no tiene pantalla", () => {
    const { completadas, totales } = contarProgreso(armarEtapas([]));

    expect(completadas).toBe(0);
    expect(totales).toBe(CHECKPOINTS_DISPONIBLES.length);
    // Cuando todas las historias estén construidas, este caso deja de existir.
    if (CHECKPOINTS_DISPONIBLES.length === CHECKPOINTS.length) return;
    expect(totales).toBeLessThan(CHECKPOINTS.length);
  });
});

describe("etapas que no aplicaron (órdenes en curso)", () => {
  function avancesHasta(ultima: string): AvanceSeccion[] {
    return [
      {
        seccion: ultima as AvanceSeccion["seccion"],
        usuarioId: "u1",
        usuarioNombre: "Camila Ríos",
        fechaHora: "2026-09-01T10:00:00Z",
      },
    ];
  }

  it("una orden que solo tiene el corte ve las etapas anteriores como 'no aplicó'", () => {
    const etapas = armarEtapas(avancesHasta("corte_completado"));
    const posicion = etapas.findIndex((e) => e.seccion === "corte_completado");

    for (const etapa of etapas.slice(0, posicion)) {
      expect(etapa.estado).toBe("no_aplico");
    }
    expect(etapas[posicion].estado).toBe("completada");
    for (const etapa of etapas.slice(posicion + 1)) {
      expect(etapa.estado).toBe("pendiente");
    }
  });

  it("una orden nueva no tiene ninguna que no aplicara", () => {
    expect(
      armarEtapas([]).filter((etapa) => etapa.estado === "no_aplico"),
    ).toEqual([]);
  });

  it("las que no aplicaron no cuentan en el avance: la orden puede llegar al 100 %", () => {
    // Una orden cerrada que nunca pasó por la etapa más temprana disponible.
    const marcadas = CHECKPOINTS_DISPONIBLES.slice(1).map((cp) => ({
      seccion: cp.id,
      usuarioId: "u1",
      usuarioNombre: "Camila Ríos",
      fechaHora: "2026-09-01T10:00:00Z",
    }));

    const progreso = contarProgreso(armarEtapas(marcadas));

    expect(progreso.completadas).toBe(progreso.totales);
    expect(progreso.totales).toBe(CHECKPOINTS_DISPONIBLES.length - 1);
  });
});

describe("describirQuienMarco", () => {
  it("pone entre paréntesis el rol dueño de la etapa, no el de la cuenta", () => {
    expect(describirQuienMarco("Paula Henao", "cotizacion_aprobada")).toBe(
      "Paula Henao (Secretaría)",
    );
    expect(describirQuienMarco("Camila Ríos", "corte_completado")).toBe(
      "Camila Ríos (Corte)",
    );
    expect(describirQuienMarco("Luis", "lista_despacho")).toBe(
      "Luis (Terminación)",
    );
  });
});

describe("armarEtapas · devoluciones y órdenes de corrección (HU-18)", () => {
  function avanceDe(
    seccion: AvanceSeccion["seccion"],
    dia: number,
  ): AvanceSeccion {
    return {
      seccion,
      usuarioId: "u1",
      usuarioNombre: "Camila Ríos",
      fechaHora: `2026-09-${String(dia).padStart(2, "0")}T10:00:00Z`,
    };
  }

  const VIGENTES = [
    avanceDe("cotizacion_enviada", 1),
    avanceDe("cotizacion_aprobada", 2),
  ];
  const ANULADO = {
    ...avanceDe("programada_diseno", 3),
    devolucionId: "d1",
  };

  it("un avance anulado no completa la etapa: queda pendiente y con su historial", () => {
    const etapa = armarEtapas(VIGENTES, [ANULADO]).find(
      (e) => e.seccion === "programada_diseno",
    );

    expect(etapa?.estado).toBe("pendiente");
    expect(etapa?.avance).toBeNull();
    expect(etapa?.anulados).toEqual([ANULADO]);
  });

  it("el avance no cuenta el anulado: la barra de progreso retrocede", () => {
    const con = contarProgreso(
      armarEtapas([...VIGENTES, avanceDe("programada_diseno", 3)]),
    );
    const sin = contarProgreso(armarEtapas(VIGENTES, [ANULADO]));

    expect(sin.completadas).toBe(con.completadas - 1);
  });

  it("si la etapa se vuelve a marcar, queda completada y conserva lo anulado", () => {
    const etapa = armarEtapas(
      [...VIGENTES, avanceDe("programada_diseno", 9)],
      [ANULADO],
    ).find((e) => e.seccion === "programada_diseno");

    expect(etapa?.estado).toBe("completada");
    expect(etapa?.avance?.fechaHora).toBe("2026-09-09T10:00:00Z");
    expect(etapa?.anulados).toHaveLength(1);
  });

  it("las etapas anteriores a la de entrada de una corrección no aplican", () => {
    const etapas = armarEtapas([], [], "corte_completado");
    const posicion = etapas.findIndex((e) => e.seccion === "corte_completado");

    for (const etapa of etapas.slice(0, posicion)) {
      expect(etapa.estado).toBe("no_aplico");
    }
    expect(etapas[posicion].estado).toBe("pendiente");
  });

  it("una corrección sin avances no cuenta las etapas que no le aplican", () => {
    const progreso = contarProgreso(armarEtapas([], [], "corte_completado"));
    const completo = contarProgreso(armarEtapas([]));

    expect(progreso.totales).toBeLessThan(completo.totales);
    expect(progreso.completadas).toBe(0);
  });

  it("quien reportó una etapa se lee con el rol de la etapa, no el de quien devolvió", () => {
    expect(describirQuienMarco("Diana Restrepo", "corte_completado")).toBe(
      "Diana Restrepo (Corte)",
    );
  });
});

describe("etapaDevuelta", () => {
  const devolucion = (
    id: string,
    destino: AvanceSeccion["seccion"],
    fechaHora: string,
  ) => ({ id, destino, motivo: "x", porNombre: "Diana", fechaHora });
  const vigentes = (...secciones: AvanceSeccion["seccion"][]) =>
    secciones.map((seccion) => ({
      seccion,
      usuarioId: "u",
      usuarioNombre: "U",
      fechaHora: "2026-09-01T10:00:00Z",
    }));

  it("sin devoluciones no hay etapa devuelta", () => {
    expect(etapaDevuelta(armarEtapas([]), [])).toBeNull();
  });

  it("es el destino de la devolución mientras siga pendiente", () => {
    const etapas = armarEtapas(vigentes("cotizacion_enviada"), []);
    expect(
      etapaDevuelta(etapas, [
        devolucion("d1", "cotizacion_aprobada", "2026-09-02T10:00:00Z"),
      ]),
    ).toBe("cotizacion_aprobada");
  });

  it("deja de serlo cuando la etapa se rehace", () => {
    const etapas = armarEtapas(
      vigentes("cotizacion_enviada", "cotizacion_aprobada"),
    );
    expect(
      etapaDevuelta(etapas, [
        devolucion("d1", "cotizacion_aprobada", "2026-09-02T10:00:00Z"),
      ]),
    ).toBeNull();
  });

  it("cuenta solo la devolución más reciente", () => {
    const etapas = armarEtapas(vigentes("cotizacion_enviada"));
    expect(
      etapaDevuelta(etapas, [
        devolucion("d2", "cotizacion_aprobada", "2026-09-03T10:00:00Z"),
        devolucion("d1", "cotizacion_enviada", "2026-09-02T10:00:00Z"),
      ]),
    ).toBe("cotizacion_aprobada");
  });
});
