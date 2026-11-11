import { describe, expect, it } from "vitest";

import {
  frasePlazo,
  pendientesParaModelo,
  redactarResumenSinIA,
  RESUMEN_AL_DIA,
  sugerenciaParaOrden,
} from "@/features/asistente/pendientes";
import type { AlertaTelaEnTablero } from "@/lib/alertas/tipos";
import type { OrdenPorAtender, Pendientes } from "@/lib/ordenes/pendientes";
import type { OrdenEnTablero } from "@/lib/ordenes/types";

// 10 oct 2026, mediodía en Marinilla.
const AHORA = new Date("2026-10-10T17:00:00Z");

function orden(parcial: Partial<OrdenEnTablero> = {}): OrdenEnTablero {
  return {
    id: "00000000-0000-0000-0000-0000000000f5",
    numeroOrdenCompra: "OC-5005",
    razonSocial: "Clínica del Norte",
    prenda: "Uniforme quirúrgico",
    cantidad: 80,
    fechaRecepcion: "2026-09-20",
    fechaEntrega: "2026-10-08",
    tallerNombre: null,
    estadoTalleres: "Todavía no ha salido a ningún taller.",
    lotesEnTaller: 0,
    tieneFicha: true,
    etapaInicial: null,
    ordenOriginal: null,
    correcciones: [],
    devoluciones: [],
    semaforo: "atrasada",
    etapas: [],
    etapasCompletadas: 6,
    etapasTotales: 13,
    ...parcial,
  };
}

function porAtender(
  parcial: Partial<OrdenEnTablero> = {},
  extra: Partial<OrdenPorAtender> = {},
): OrdenPorAtender {
  return {
    orden: orden(parcial),
    diasSinAvance: 4,
    parada: { area: "Corte", siguiente: "Corte completado", enTaller: false },
    ...extra,
  };
}

const ALERTA_TELA: AlertaTelaEnTablero = {
  tipo: "falta_tela",
  id: "a1",
  ordenId: "00000000-0000-0000-0000-0000000000f3",
  detalle: "Faltan 40 metros de dril azul",
  fechaCreacion: "2026-10-08T15:00:00Z",
  numeroOrdenCompra: "OC-5003",
  razonSocial: "Colegio San José",
  enviadaPor: "Paula",
};

const VACIO: Pendientes = {
  atrasadas: [],
  enRiesgo: [],
  detenidas: [],
  alertasDeTela: [],
  avisosDeEntrega: [],
};

describe("frasePlazo", () => {
  it("dice el plazo en palabras del taller", () => {
    expect(frasePlazo("2026-10-08", AHORA)).toBe("se venció hace 2 días");
    expect(frasePlazo("2026-10-09", AHORA)).toBe("se venció hace 1 día");
    expect(frasePlazo("2026-10-10", AHORA)).toBe("entrega hoy");
    expect(frasePlazo("2026-10-11", AHORA)).toBe("entrega mañana");
    expect(frasePlazo("2026-10-13", AHORA)).toBe("entrega en 3 días");
  });
});

describe("sugerenciaParaOrden", () => {
  it("propone en condicional y nombra el área y la etapa reales", () => {
    const texto = sugerenciaParaOrden(porAtender(), "atrasada");

    expect(texto).toMatch(/^Podrías/);
    expect(texto).toContain("Corte");
    expect(texto).toContain("«Corte completado»");
  });

  it("en riesgo, nombra la fecha de entrega", () => {
    expect(
      sugerenciaParaOrden(
        porAtender({ fechaEntrega: "2026-10-12", semaforo: "en_riesgo" }),
        "en_riesgo",
      ),
    ).toContain("12/10/2026");
  });

  it("detenida, dice cuántos días lleva quieta", () => {
    expect(sugerenciaParaOrden(porAtender(), "detenida")).toMatch(
      /^Lleva 4 días sin avance: podrías preguntarle a Corte/,
    );
  });

  it("en el taller, la sugerencia es con Logística", () => {
    const texto = sugerenciaParaOrden(
      porAtender(
        {},
        {
          parada: {
            area: "Taller satélite",
            siguiente: "Logística confirma la recepción de las prendas",
            enTaller: true,
          },
        },
      ),
      "atrasada",
    );

    expect(texto).toContain("Logística");
    expect(texto).toContain("taller");
  });

  it("ninguna sugerencia da órdenes", () => {
    for (const situacion of ["atrasada", "en_riesgo", "detenida"] as const) {
      expect(sugerenciaParaOrden(porAtender(), situacion)).toMatch(/podrías/i);
    }
  });
});

describe("pendientesParaModelo", () => {
  it("lleva el enlace a la orden y el plazo calculado", () => {
    const datos = pendientesParaModelo(
      { ...VACIO, atrasadas: [porAtender()] },
      AHORA,
    );

    expect(datos.alDia).toBe(false);
    expect(datos.atrasadas.total).toBe(1);
    expect(datos.atrasadas.ordenes[0]).toMatchObject({
      numeroOrdenCompra: "OC-5005",
      cliente: "Clínica del Norte",
      plazo: "se venció hace 2 días",
      fechaEntrega: "08/10/2026",
      dondeEsta: "Corte",
      enlace: "/tablero/00000000-0000-0000-0000-0000000000f5",
    });
  });

  it("cuenta todas pero detalla solo las primeras de cada grupo", () => {
    const muchas = Array.from({ length: 7 }, () => porAtender());

    const datos = pendientesParaModelo(
      { ...VACIO, detenidas: muchas },
      AHORA,
      5,
    );

    expect(datos.detenidas.total).toBe(7);
    expect(datos.detenidas.ordenes).toHaveLength(5);
  });

  it("las alertas de tela dicen desde cuándo están abiertas y enlazan su orden", () => {
    const datos = pendientesParaModelo(
      { ...VACIO, alertasDeTela: [ALERTA_TELA] },
      AHORA,
    );

    expect(datos.alertasDeTela.ordenes[0]).toMatchObject({
      abiertaDesde: "hace 2 días",
      avisoDe: "Paula",
      enlace: "/tablero/00000000-0000-0000-0000-0000000000f3",
    });
  });
});

describe("redactarResumenSinIA", () => {
  it("si no hay nada pendiente lo dice en una línea", () => {
    expect(redactarResumenSinIA(pendientesParaModelo(VACIO, AHORA))).toBe(
      RESUMEN_AL_DIA,
    );
  });

  it("arma una sección por grupo, con sugerencia y enlace por orden", () => {
    const texto = redactarResumenSinIA(
      pendientesParaModelo(
        {
          ...VACIO,
          atrasadas: [porAtender()],
          alertasDeTela: [ALERTA_TELA],
          avisosDeEntrega: [
            {
              tipo: "proximidad_entrega",
              id: "a2",
              ordenId: "f4",
              numeroOrdenCompra: "OC-5004",
              razonSocial: "Transportes La Mesa",
              fechaEntrega: "2026-10-12",
            },
          ],
        },
        AHORA,
      ),
    );

    expect(texto).toContain("**Atrasadas (1)**");
    expect(texto).toContain(
      "- OC-5005 de Clínica del Norte: se venció hace 2 días (08/10/2026). Está en Corte.",
    );
    expect(texto).toContain(
      "[Consúltala aquí](/tablero/00000000-0000-0000-0000-0000000000f5)",
    );
    expect(texto).toContain("**Alertas de tela sin atender (1)**");
    expect(texto).toContain("«Faltan 40 metros de dril azul»");
    expect(texto).toContain("**Avisos de entrega sin revisar: 1.**");
    expect(texto).not.toContain("En riesgo de entrega");
    expect(texto).toMatch(/las decisiones las tomas tú/);
  });

  it("dice cuántas más hay cuando no caben todas", () => {
    const texto = redactarResumenSinIA(
      pendientesParaModelo(
        {
          ...VACIO,
          enRiesgo: Array.from({ length: 3 }, () =>
            porAtender({ semaforo: "en_riesgo" }),
          ),
        },
        AHORA,
        2,
      ),
    );

    expect(texto).toContain("**En riesgo de entrega (3)**");
    expect(texto).toContain(
      "- Y 1 más: las ves todas en el [tablero](/tablero).",
    );
  });
});
