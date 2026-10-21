import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetalleOrdenView } from "@/features/tablero/components/DetalleOrdenView";
import { FilaOrden } from "@/features/tablero/components/FilaOrden";
import {
  CHECKPOINTS,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { armarEtapas, contarProgreso } from "@/lib/ordenes/reglas";
import type {
  AvanceAnulado,
  AvanceSeccion,
  DetalleOrden,
  Devolucion,
} from "@/lib/ordenes/types";

/**
 * HU-18 · Solo la etapa a la que se devolvió la orden dice "Devuelta", y solo
 * mientras sigue sin rehacerse. Las demás etapas con avances anulados conservan
 * su historial pero no la marca.
 */

function avance(seccion: CheckpointId, fechaHora: string): AvanceSeccion {
  return { seccion, usuarioId: "u1", usuarioNombre: "Jorge", fechaHora };
}

function anulado(seccion: CheckpointId, devolucionId: string): AvanceAnulado {
  return {
    ...avance(seccion, "2026-10-10T10:00:00Z"),
    devolucionId,
  };
}

function devolucion(id: string, destino: CheckpointId): Devolucion {
  return {
    id,
    destino,
    motivo: "Defecto",
    porNombre: "Diana",
    fechaHora: "2026-10-13T15:00:00Z",
  };
}

const HASTA_CORTE: CheckpointId[] = CHECKPOINTS.map((c) => c.id).slice(
  0,
  CHECKPOINTS.findIndex((c) => c.id === "corte_completado") + 1,
);

function orden(
  vigentes: CheckpointId[],
  anulados: AvanceAnulado[],
  devoluciones: Devolucion[],
): DetalleOrden {
  const etapas = armarEtapas(
    vigentes.map((seccion) => avance(seccion, "2026-10-14T10:00:00Z")),
    anulados,
  );
  const { completadas, totales } = contarProgreso(etapas);
  return {
    id: "f3",
    numeroOrdenCompra: "OC-5003",
    razonSocial: "Colegio San José",
    prenda: "Camisa",
    cantidad: 10,
    fechaRecepcion: "2026-09-12",
    fechaEntrega: "2026-10-30",
    tallerNombre: null,
    estadoTalleres: "Todavía no ha salido a ningún taller.",
    lotesEnTaller: 0,
    tieneFicha: false,
    etapaInicial: null,
    ordenOriginal: null,
    correcciones: [],
    devoluciones,
    semaforo: "a_tiempo",
    etapas,
    etapasCompletadas: completadas,
    etapasTotales: totales,
    avances: [],
    fichas: [],
  };
}

// Se devolvió a Corte (anuló corte y recogido) y el corte ya se rehízo:
// "Recogido y bordado" sigue pendiente con un avance anulado, pero no es el
// destino de la devolución.
const CORTE_REHECHO = orden(
  HASTA_CORTE,
  [anulado("corte_completado", "d1"), anulado("recogido_bordado", "d1")],
  [devolucion("d1", "corte_completado")],
);

// Se devolvió a Recogido y bordado y todavía no se rehace.
const RECOGIDO_SIN_REHACER = orden(
  HASTA_CORTE,
  [anulado("recogido_bordado", "d1")],
  [devolucion("d1", "recogido_bordado")],
);

describe("la marca 'Devuelta' en la fila del tablero", () => {
  it("no aparece si la etapa destino ya se rehízo, aunque otra tenga avances anulados", () => {
    render(<FilaOrden orden={CORTE_REHECHO} />);

    expect(screen.queryByText(/Devuelta a/)).toBeNull();
  });

  it("nombra la etapa destino mientras no se rehace", () => {
    render(<FilaOrden orden={RECOGIDO_SIN_REHACER} />);

    expect(screen.getByText("Devuelta a Recogido y bordado")).toBeVisible();
  });
});

describe("la marca 'Devuelta' en el detalle de la orden", () => {
  it("la etapa destino sin rehacer es la única que dice 'Devuelta'", () => {
    render(<DetalleOrdenView orden={RECOGIDO_SIN_REHACER} />);

    expect(screen.getAllByText("Devuelta")).toHaveLength(1);
  });

  it("si el destino ya se rehízo, ninguna etapa dice 'Devuelta' pero se ve el historial", () => {
    render(<DetalleOrdenView orden={CORTE_REHECHO} />);

    expect(screen.queryByText("Devuelta")).toBeNull();
    // Las dos etapas con avances anulados siguen mostrando su historial.
    expect(screen.getAllByText(/Se había marcado el/)).toHaveLength(2);
  });
});
