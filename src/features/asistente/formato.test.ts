import { describe, expect, it } from "vitest";

import {
  detallarOrden,
  filtrarOrdenes,
  filtrarPorEstado,
  normalizar,
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

const AHORA = new Date("2026-10-10T12:00:00");

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
    semaforo: "a_tiempo",
    etapas,
    etapasCompletadas: completadas,
    etapasTotales: totales,
    avances,
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
        quien: "Camila Ríos",
        cuando: expect.stringMatching(/9\/10\/2026.*10:12/),
        observacion: "Faltó un rollo",
      },
    ]);
    // Pendiente es toda etapa disponible sin marcar, no solo las que vienen
    // después: esta orden tiene el corte marcado y nada más.
    expect(detalle.etapasPendientes).toEqual(
      CHECKPOINTS_DISPONIBLES.filter((cp) => cp.id !== "corte_completado").map(
        (cp) => cp.etiqueta,
      ),
    );
  });
});

describe("filtrarOrdenes", () => {
  const ordenes = [
    ordenStub(),
    ordenStub({
      id: "f5",
      numeroOrdenCompra: "OC-5005",
      razonSocial: "Dotaciones Ríos",
    }),
  ];

  it("encuentra por parte del número, sin importar mayúsculas ni el prefijo", () => {
    expect(filtrarOrdenes(ordenes, "5003").map((o) => o.id)).toEqual(["f3"]);
    expect(filtrarOrdenes(ordenes, "oc-5005").map((o) => o.id)).toEqual(["f5"]);
  });

  it("encuentra por el cliente sin tildes", () => {
    expect(filtrarOrdenes(ordenes, "san jose").map((o) => o.id)).toEqual([
      "f3",
    ]);
    expect(filtrarOrdenes(ordenes, "RIOS").map((o) => o.id)).toEqual(["f5"]);
  });

  it("no devuelve nada con un texto vacío", () => {
    expect(filtrarOrdenes(ordenes, "   ")).toEqual([]);
  });

  it("entiende el guion no separable que escriben los modelos", () => {
    expect(filtrarOrdenes(ordenes, "OC\u20115003").map((o) => o.id)).toEqual([
      "f3",
    ]);
  });
});

describe("filtrarPorEstado", () => {
  const sinEmpezar = ordenStub({ id: "a" });
  const enProduccion = ordenStub({
    id: "b",
    semaforo: "atrasada",
    avances: [avance("corte_completado", "2026-10-01T10:00:00Z")],
  });
  const terminada = ordenStub({
    id: "c",
    semaforo: "en_riesgo",
    avances: CHECKPOINTS_DISPONIBLES.map((cp, i) =>
      avance(cp.id, diaDeOctubre(i)),
    ),
  });
  const ordenes = [sinEmpezar, enProduccion, terminada];
  const ids = (lista: OrdenEnTablero[]) => lista.map((o) => o.id);

  it("separa por avance", () => {
    expect(ids(filtrarPorEstado(ordenes, "todas"))).toEqual(["a", "b", "c"]);
    expect(ids(filtrarPorEstado(ordenes, "sin_empezar"))).toEqual(["a"]);
    expect(ids(filtrarPorEstado(ordenes, "en_produccion"))).toEqual(["b"]);
    expect(ids(filtrarPorEstado(ordenes, "terminadas"))).toEqual(["c"]);
  });

  it("separa por semáforo", () => {
    expect(ids(filtrarPorEstado(ordenes, "atrasadas"))).toEqual(["b"]);
    expect(ids(filtrarPorEstado(ordenes, "en_riesgo"))).toEqual(["c"]);
  });
});

describe("normalizar", () => {
  it("quita tildes, virgulillas, mayúsculas y espacios de sobra", () => {
    // La ñ también pierde su virgulilla: así "nandu" encuentra a "Ñandú".
    expect(normalizar("  Confección Ñandú ")).toBe("confeccion nandu");
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
