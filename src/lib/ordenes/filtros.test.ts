import { describe, expect, it } from "vitest";

import { CHECKPOINTS_DISPONIBLES } from "@/features/workflow/checkpoints";
import {
  contarFiltros,
  dondeEsta,
  filtrarOrdenes,
  filtrarPorEstado,
  filtrarTablero,
  leerFiltros,
  normalizar,
  ordenarPorUrgencia,
} from "@/lib/ordenes/filtros";
import { armarEtapas, contarProgreso } from "@/lib/ordenes/reglas";
import type { AvanceSeccion, OrdenEnTablero } from "@/lib/ordenes/types";

const AHORA = new Date("2026-10-10T12:00:00");

function diaDeOctubre(i: number): string {
  return `2026-10-${String(i + 1).padStart(2, "0")}T10:00:00Z`;
}

function avance(
  seccion: AvanceSeccion["seccion"],
  fechaHora: string,
): AvanceSeccion {
  return { seccion, usuarioId: "u1", usuarioNombre: "Camila Ríos", fechaHora };
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
    prenda: "Camisa · Pantalón",
    cantidad: 120,
    fechaRecepcion: "2026-09-12",
    fechaEntrega: "2026-10-30",
    tallerNombre: null,
    estadoTalleres: "Todavía no ha salido a ningún taller.",
    lotesEnTaller: 0,
    tieneFicha: false,
    semaforo: "a_tiempo",
    etapas,
    etapasCompletadas: completadas,
    etapasTotales: totales,
    ...resto,
  };
}

/** Marca todas las etapas disponibles hasta `id` inclusive. */
function hasta(id: AvanceSeccion["seccion"]): AvanceSeccion[] {
  const i = CHECKPOINTS_DISPONIBLES.findIndex((cp) => cp.id === id);
  return CHECKPOINTS_DISPONIBLES.slice(0, i + 1).map((cp, n) =>
    avance(cp.id, diaDeOctubre(n)),
  );
}

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
    expect(filtrarOrdenes(ordenes, "OC‑5003").map((o) => o.id)).toEqual(["f3"]);
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

describe("dondeEsta", () => {
  it("lee la sección a la que le toca la siguiente etapa", () => {
    expect(dondeEsta(ordenStub({ avances: hasta("tela_programada") }))).toBe(
      "corte",
    );
    expect(dondeEsta(ordenStub({ avances: hasta("corte_completado") }))).toBe(
      "bordado",
    );
    expect(dondeEsta(ordenStub({ avances: hasta("recogido_bordado") }))).toBe(
      "marcacion",
    );
  });

  it("es taller mientras haya lotes sin recibir", () => {
    expect(
      dondeEsta(
        ordenStub({ avances: hasta("recogido_bordado"), lotesEnTaller: 1 }),
      ),
    ).toBe("taller");
  });
});

describe("ordenarPorUrgencia", () => {
  it("pone atrasadas, luego en riesgo y luego por fecha de entrega", () => {
    const lista = [
      ordenStub({ id: "tarde", fechaEntrega: "2026-12-01" }),
      ordenStub({ id: "pronto", fechaEntrega: "2026-11-01" }),
      ordenStub({
        id: "riesgo",
        semaforo: "en_riesgo",
        fechaEntrega: "2026-10-12",
      }),
      ordenStub({
        id: "atr2",
        semaforo: "atrasada",
        fechaEntrega: "2026-10-08",
      }),
      ordenStub({
        id: "atr1",
        semaforo: "atrasada",
        fechaEntrega: "2026-10-01",
      }),
    ];
    expect(ordenarPorUrgencia(lista).map((o) => o.id)).toEqual([
      "atr1",
      "atr2",
      "riesgo",
      "pronto",
      "tarde",
    ]);
  });
});

describe("filtrarTablero", () => {
  const ordenes = [
    ordenStub({
      id: "a",
      fechaEntrega: "2026-10-14",
      avances: hasta("tela_programada"),
    }),
    ordenStub({
      id: "b",
      numeroOrdenCompra: "OC-5005",
      razonSocial: "Dotaciones Ríos",
      semaforo: "atrasada",
      fechaEntrega: "2026-10-05",
      avances: hasta("corte_completado"),
    }),
    ordenStub({
      id: "c",
      numeroOrdenCompra: "OC-5006",
      razonSocial: "Clínica del Norte",
      fechaEntrega: "2026-11-20",
      lotesEnTaller: 2,
      avances: hasta("recogido_bordado"),
    }),
  ];
  const ids = (l: OrdenEnTablero[]) => l.map((o) => o.id);
  const sin = { q: "", filtro: null, donde: null } as const;

  it("sin filtros devuelve todas, ordenadas por urgencia", () => {
    expect(ids(filtrarTablero(ordenes, sin, AHORA))).toEqual(["b", "a", "c"]);
  });

  it("busca por cliente sin tildes", () => {
    expect(
      ids(filtrarTablero(ordenes, { ...sin, q: "clinica" }, AHORA)),
    ).toEqual(["c"]);
  });

  it("filtra por atrasadas y por entrega esta semana", () => {
    expect(
      ids(filtrarTablero(ordenes, { ...sin, filtro: "atrasadas" }, AHORA)),
    ).toEqual(["b"]);
    expect(
      ids(filtrarTablero(ordenes, { ...sin, filtro: "esta_semana" }, AHORA)),
    ).toEqual(["a"]);
  });

  it("combina texto, filtro y dónde con Y", () => {
    expect(
      ids(
        filtrarTablero(
          ordenes,
          { q: "oc", filtro: null, donde: "taller" },
          AHORA,
        ),
      ),
    ).toEqual(["c"]);
    expect(
      ids(
        filtrarTablero(
          ordenes,
          { q: "rios", filtro: null, donde: "taller" },
          AHORA,
        ),
      ),
    ).toEqual([]);
  });

  it("cuenta lo que muestra cada botón", () => {
    const conteos = contarFiltros(ordenes, "", AHORA);
    expect(conteos.filtro).toEqual({
      atrasadas: 1,
      en_riesgo: 0,
      esta_semana: 1,
    });
    expect(conteos.donde).toEqual({
      corte: 1,
      bordado: 1,
      taller: 1,
      marcacion: 0,
    });
  });
});

describe("leerFiltros", () => {
  it("lee la URL e ignora valores desconocidos", () => {
    expect(
      leerFiltros({ q: " san ", filtro: "atrasadas", donde: "corte" }),
    ).toEqual({ q: "san", filtro: "atrasadas", donde: "corte" });
    expect(leerFiltros({ filtro: "x", donde: ["taller", "corte"] })).toEqual({
      q: "",
      filtro: null,
      donde: "taller",
    });
  });
});
