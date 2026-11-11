import { describe, expect, it } from "vitest";

import { CHECKPOINTS_DISPONIBLES } from "@/features/workflow/checkpoints";
import type { AlertaDelTablero } from "@/lib/alertas/tipos";
import {
  clasificarPendientes,
  DIAS_SIN_AVANCE_DETENIDA,
  diasSinAvance,
  dondeEstaParada,
  estaAlDia,
} from "@/lib/ordenes/pendientes";
import { armarEtapas, contarProgreso } from "@/lib/ordenes/reglas";
import type { AvanceSeccion, OrdenEnTablero } from "@/lib/ordenes/types";

// 10 oct 2026, mediodía en Marinilla.
const AHORA = new Date("2026-10-10T17:00:00Z");

function avance(
  seccion: AvanceSeccion["seccion"],
  fechaHora: string,
): AvanceSeccion {
  return { seccion, usuarioId: "u1", usuarioNombre: "Camila Ríos", fechaHora };
}

/** Marca todas las etapas disponibles hasta `id`, la última en `fechaHora`. */
function hasta(
  id: AvanceSeccion["seccion"],
  fechaHora = "2026-10-09T15:00:00Z",
): AvanceSeccion[] {
  const i = CHECKPOINTS_DISPONIBLES.findIndex((cp) => cp.id === id);
  return CHECKPOINTS_DISPONIBLES.slice(0, i + 1).map((cp, n) =>
    avance(cp.id, n === i ? fechaHora : "2026-09-20T15:00:00Z"),
  );
}

function ordenStub(
  parcial: Partial<OrdenEnTablero> & { avances?: AvanceSeccion[] } = {},
): OrdenEnTablero {
  const { avances = [], ...resto } = parcial;
  const etapas = armarEtapas(avances);
  const { completadas, totales } = contarProgreso(etapas);
  return {
    id: "f3",
    numeroOrdenCompra: "OC-5003",
    razonSocial: "Colegio San José",
    prenda: "Camisa",
    cantidad: 120,
    fechaRecepcion: "2026-10-09",
    fechaEntrega: "2026-10-30",
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
    ...resto,
  };
}

const ALERTA_TELA: AlertaDelTablero = {
  tipo: "falta_tela",
  id: "a1",
  ordenId: "f3",
  detalle: "Faltan 40 metros de dril azul",
  fechaCreacion: "2026-10-08T15:00:00Z",
  numeroOrdenCompra: "OC-5003",
  razonSocial: "Colegio San José",
  enviadaPor: "Paula",
};

const AVISO_ENTREGA: AlertaDelTablero = {
  tipo: "proximidad_entrega",
  id: "a2",
  ordenId: "f4",
  numeroOrdenCompra: "OC-5004",
  razonSocial: "Transportes La Mesa",
  fechaEntrega: "2026-10-12",
};

describe("diasSinAvance", () => {
  it("cuenta desde el último avance, en el día de Colombia", () => {
    // 4 oct a las 8 p. m. en Marinilla es 5 oct en UTC: cuenta el 4.
    const orden = ordenStub({
      avances: hasta("corte_completado", "2026-10-05T01:00:00Z"),
    });

    expect(diasSinAvance(orden, AHORA)).toBe(6);
  });

  it("sin avances cuenta desde que se registró la orden", () => {
    expect(
      diasSinAvance(ordenStub({ fechaRecepcion: "2026-10-01" }), AHORA),
    ).toBe(9);
  });

  it("un avance de hoy son cero días", () => {
    const orden = ordenStub({
      avances: hasta("corte_completado", "2026-10-10T14:00:00Z"),
    });

    expect(diasSinAvance(orden, AHORA)).toBe(0);
  });
});

describe("dondeEstaParada", () => {
  it("es el rol dueño de la etapa que sigue", () => {
    expect(
      dondeEstaParada(ordenStub({ avances: hasta("corte_completado") })),
    ).toEqual({
      area: "Logística",
      siguiente: "Recogido y bordado",
      enTaller: false,
    });
  });

  it("una orden recién registrada la mueve secretaría", () => {
    expect(dondeEstaParada(ordenStub())?.area).toBe("Secretaría");
  });

  it("con lotes sin recibir está en el taller", () => {
    expect(
      dondeEstaParada(
        ordenStub({ avances: hasta("recogido_bordado"), lotesEnTaller: 1 }),
      ),
    ).toMatchObject({ area: "Taller satélite", enTaller: true });
  });

  it("una orden que recorrió todo no está parada en ninguna parte", () => {
    expect(dondeEstaParada(ordenStub({ avances: hasta("cerrada") }))).toBe(
      null,
    );
  });
});

describe("clasificarPendientes", () => {
  it("separa atrasadas, en riesgo y detenidas, cada orden una sola vez", () => {
    const atrasada = ordenStub({
      id: "f1",
      numeroOrdenCompra: "OC-5001",
      fechaEntrega: "2026-10-08",
      semaforo: "atrasada",
      // También lleva días quieta, pero lo urgente es el atraso.
      fechaRecepcion: "2026-09-01",
    });
    const enRiesgo = ordenStub({
      id: "f2",
      numeroOrdenCompra: "OC-5002",
      fechaEntrega: "2026-10-12",
      semaforo: "en_riesgo",
    });
    const detenida = ordenStub({
      id: "f3",
      fechaRecepcion: "2026-10-01",
    });
    const alDia = ordenStub({ id: "f4", numeroOrdenCompra: "OC-5004" });

    const pendientes = clasificarPendientes(
      [alDia, detenida, enRiesgo, atrasada],
      [],
      AHORA,
    );

    expect(pendientes.atrasadas.map((p) => p.orden.id)).toEqual(["f1"]);
    expect(pendientes.enRiesgo.map((p) => p.orden.id)).toEqual(["f2"]);
    expect(pendientes.detenidas.map((p) => p.orden.id)).toEqual(["f3"]);
    expect(pendientes.detenidas[0].diasSinAvance).toBe(9);
  });

  it(`detenida es desde ${DIAS_SIN_AVANCE_DETENIDA} días sin avance`, () => {
    const justo = ordenStub({ id: "f1", fechaRecepcion: "2026-10-07" });
    const casi = ordenStub({ id: "f2", fechaRecepcion: "2026-10-08" });

    const { detenidas } = clasificarPendientes([justo, casi], [], AHORA);

    expect(detenidas.map((p) => p.orden.id)).toEqual(["f1"]);
  });

  it("una orden en el taller no cuenta como detenida", () => {
    const enTaller = ordenStub({
      avances: hasta("recogido_bordado", "2026-09-25T15:00:00Z"),
      lotesEnTaller: 2,
    });

    expect(clasificarPendientes([enTaller], [], AHORA).detenidas).toEqual([]);
  });

  it("una orden en el taller sí cuenta si está atrasada", () => {
    const enTaller = ordenStub({
      avances: hasta("recogido_bordado"),
      lotesEnTaller: 1,
      fechaEntrega: "2026-10-05",
      semaforo: "atrasada",
    });

    const [item] = clasificarPendientes([enTaller], [], AHORA).atrasadas;
    expect(item.parada.area).toBe("Taller satélite");
  });

  it("las cerradas no aparecen aunque su fecha haya pasado", () => {
    const cerrada = ordenStub({
      avances: hasta("cerrada"),
      fechaEntrega: "2026-10-01",
      semaforo: "entregada",
    });

    expect(estaAlDia(clasificarPendientes([cerrada], [], AHORA))).toBe(true);
  });

  it("ordena las atrasadas por urgencia y las detenidas por días quietas", () => {
    const pendientes = clasificarPendientes(
      [
        ordenStub({
          id: "a2",
          numeroOrdenCompra: "OC-2",
          fechaEntrega: "2026-10-09",
          semaforo: "atrasada",
        }),
        ordenStub({
          id: "a1",
          numeroOrdenCompra: "OC-1",
          fechaEntrega: "2026-10-02",
          semaforo: "atrasada",
        }),
        ordenStub({ id: "d1", fechaRecepcion: "2026-10-05" }),
        ordenStub({ id: "d2", fechaRecepcion: "2026-09-25" }),
      ],
      [],
      AHORA,
    );

    expect(pendientes.atrasadas.map((p) => p.orden.id)).toEqual(["a1", "a2"]);
    expect(pendientes.detenidas.map((p) => p.orden.id)).toEqual(["d2", "d1"]);
  });

  it("reparte las alertas por tipo", () => {
    const pendientes = clasificarPendientes(
      [],
      [AVISO_ENTREGA, ALERTA_TELA],
      AHORA,
    );

    expect(pendientes.alertasDeTela).toEqual([ALERTA_TELA]);
    expect(pendientes.avisosDeEntrega).toEqual([AVISO_ENTREGA]);
    expect(estaAlDia(pendientes)).toBe(false);
  });

  it("sin órdenes ni alertas está al día", () => {
    expect(estaAlDia(clasificarPendientes([], [], AHORA))).toBe(true);
  });
});
