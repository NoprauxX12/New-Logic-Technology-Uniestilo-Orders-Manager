import { describe, expect, it } from "vitest";

import { CHECKPOINTS } from "@/features/workflow/checkpoints";
import {
  DIAS_EN_RIESGO,
  armarEtapas,
  derivarSemaforo,
  diasHasta,
  resumirTablero,
} from "@/features/tablero/reglas";
import type { AvanceSeccion, OrdenEnTablero } from "@/features/tablero/types";

/** Fecha fija para que los tests no dependan del reloj del PC. */
const AHORA = new Date("2026-09-06T12:00:00");

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

describe("derivarSemaforo", () => {
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
