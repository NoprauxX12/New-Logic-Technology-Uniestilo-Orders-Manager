import { describe, expect, it } from "vitest";

import {
  detallarOrden,
  pareceUuid,
  resumirOrden,
} from "@/features/asistente/formato";
import {
  CHECKPOINTS_DISPONIBLES,
  ETIQUETAS_ROL,
} from "@/features/workflow/checkpoints";
import { armarEtapas, contarProgreso } from "@/lib/ordenes/reglas";
import type {
  AvanceSeccion,
  DetalleOrden,
  OrdenEnTablero,
} from "@/lib/ordenes/types";

const AHORA = new Date("2026-10-10T17:00:00Z");

// Las etapas disponibles cambian cada sprint (cada HU pone la suya en
// `disponible: true`): las expectativas salen de `checkpoints.ts`, no se fijan.
const TOTAL = CHECKPOINTS_DISPONIBLES.length;
const INDICE_CORTE = CHECKPOINTS_DISPONIBLES.findIndex(
  (cp) => cp.id === "corte_completado",
);
/** Lo que una orden lleva marcado cuando acaba de pasar por corte. */
const HASTA_CORTE = CHECKPOINTS_DISPONIBLES.slice(0, INDICE_CORTE + 1);
const DESPUES_DEL_CORTE = CHECKPOINTS_DISPONIBLES.slice(INDICE_CORTE + 1);

/** Una fecha distinta por etapa, en orden, sin importar cuántas haya. */
function diaDeOctubre(i: number): string {
  return `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z`;
}

function avance(
  seccion: AvanceSeccion["seccion"],
  fechaHora: string,
  observacion?: string,
): AvanceSeccion {
  return {
    seccion,
    usuarioId: "u1",
    usuarioNombre: "Camila Ríos",
    fechaHora,
    observacion,
  };
}

function ordenStub(
  parcial: Partial<OrdenEnTablero> & { avances?: AvanceSeccion[] } = {},
): DetalleOrden {
  const avances = parcial.avances ?? [];
  const etapas = armarEtapas(avances);
  const { completadas, totales } = contarProgreso(etapas);
  return {
    id: "f3",
    numeroOrdenCompra: "OC-5003",
    razonSocial: "Colegio San José",
    prenda: "Camisa · Pantalón",
    cantidad: 120,
    fechaRecepcion: "2026-09-12",
    fechaEntrega: "2026-10-16",
    tallerNombre: null,
    estadoTalleres: "Todavía no ha salido a ningún taller.",
    lotesEnTaller: 0,
    tieneFicha: false,
    etapaInicial: null,
    ordenOriginal: null,
    correcciones: [],
    devoluciones: [],
    semaforo: "a_tiempo",
    etapas,
    etapasCompletadas: completadas,
    etapasTotales: totales,
    avances,
    fichas: [],
    ...parcial,
  };
}

describe("resumirOrden", () => {
  it("cuenta la orden en lenguaje del taller, con fechas legibles", () => {
    const resumen = resumirOrden(
      // El recorrido completo hasta el corte, no solo esa marca: el motor no
      // deja marcar una etapa sin las anteriores, y así "lo que sigue" es de
      // verdad lo que sigue al corte.
      ordenStub({
        avances: HASTA_CORTE.map((cp, i) =>
          avance(
            cp.id,
            i === HASTA_CORTE.length - 1
              ? "2026-10-09T15:12:00Z"
              : diaDeOctubre(i),
          ),
        ),
      }),
      AHORA,
    );

    expect(resumen).toMatchObject({
      ordenId: "f3",
      numeroOrdenCompra: "OC-5003",
      cliente: "Colegio San José",
      cantidadTotal: 120,
      fechaIngreso: "12/09/2026",
      fechaEntrega: "16/10/2026",
      diasParaEntrega: 6,
      semaforo: "a tiempo",
      etapaActual: "Corte completado",
      loQueSigue: {
        etapa: DESPUES_DEL_CORTE[0].etiqueta,
        responsable: ETIQUETAS_ROL[DESPUES_DEL_CORTE[0].rolDueno],
      },
      avance: `${HASTA_CORTE.length} de ${TOTAL} etapas`,
      enlace: "/tablero/f3",
    });
  });

  it("dice que no hay etapas marcadas cuando la orden está recién registrada", () => {
    const resumen = resumirOrden(ordenStub(), AHORA);

    expect(resumen.etapaActual).toMatch(/sin etapas marcadas/);
    expect(resumen.loQueSigue).toEqual({
      etapa: CHECKPOINTS_DISPONIBLES[0].etiqueta,
      responsable: ETIQUETAS_ROL[CHECKPOINTS_DISPONIBLES[0].rolDueno],
    });
  });

  it("no tiene nada que seguir cuando la orden está cerrada", () => {
    const todas = CHECKPOINTS_DISPONIBLES.map((cp, i) =>
      avance(cp.id, diaDeOctubre(i)),
    );
    const resumen = resumirOrden(ordenStub({ avances: todas }), AHORA);

    expect(resumen.etapaActual).toBe("Orden cerrada");
    expect(resumen.loQueSigue).toBeNull();
    expect(resumen.avance).toBe(`${TOTAL} de ${TOTAL} etapas`);
  });

  it("le dice al modelo que una orden cerrada está entregada, no atrasada", () => {
    const resumen = resumirOrden(
      ordenStub({ semaforo: "entregada", fechaEntrega: "2026-09-01" }),
      AHORA,
    );

    expect(resumen.semaforo).toMatch(/^entregada/);
  });
});

describe("detallarOrden", () => {
  it("agrega quién marcó cada etapa, cuándo (hora de Colombia) y qué falta", () => {
    const detalle = detallarOrden(
      ordenStub({
        avances: [
          avance("corte_completado", "2026-10-09T15:12:00Z", "Faltó un rollo"),
        ],
      }),
      CHECKPOINTS_DISPONIBLES,
      AHORA,
    );

    expect(detalle.historial).toEqual([
      {
        etapa: "Corte completado",
        quien: "Camila Ríos (Corte)",
        cuando: expect.stringMatching(/9\/10\/2026.*10:12/),
        observacion: "Faltó un rollo",
      },
    ]);
    // Pendiente es lo que viene después del avance de la orden. Lo que quedó
    // atrás sin marcarse (esta orden tiene el corte y nada más) no aplicó: no se
    // puede marcar, así que tampoco se le ofrece a nadie como pendiente.
    expect(detalle.etapasPendientes).toEqual(
      CHECKPOINTS_DISPONIBLES.slice(
        CHECKPOINTS_DISPONIBLES.findIndex(
          (cp) => cp.id === "corte_completado",
        ) + 1,
      ).map((cp) => cp.etiqueta),
    );
  });
});

describe("pareceUuid", () => {
  it("distingue un id de orden de un número o un cliente", () => {
    expect(pareceUuid("00000000-0000-0000-0000-0000000000f3")).toBe(true);
    expect(pareceUuid("2f1c9d2e-7b4a-4c1d-9e3f-0a1b2c3d4e5f")).toBe(true);
    expect(pareceUuid("OC-5003")).toBe(false);
    expect(pareceUuid("Clínica del Norte")).toBe(false);
  });
});
