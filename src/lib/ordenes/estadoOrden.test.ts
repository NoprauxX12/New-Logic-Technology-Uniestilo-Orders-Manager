import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Los enlaces entre una orden y su corrección (HU-18) se resuelven con lo
 * justo: el tablero no hace una consulta extra y el detalle pide solo la
 * original y las correcciones de esa orden, no toda la tabla.
 */

type Llamada = { metodo: string; args: unknown[] };
type Consulta = { tabla: string; llamadas: Llamada[] };

const consultas = vi.hoisted(() => [] as Consulta[]);
const respuestas = vi.hoisted(() => ({
  ordenes: [] as unknown[],
  enlaces: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/storage/firmarFichas", () => ({
  firmarFichas: async () => [],
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from(tabla: string) {
      const consulta: Consulta = { tabla, llamadas: [] };
      consultas.push(consulta);
      const constructor: Record<string, unknown> = {};
      for (const metodo of ["select", "eq", "or", "order", "is"]) {
        constructor[metodo] = (...args: unknown[]) => {
          consulta.llamadas.push({ metodo, args });
          return constructor;
        };
      }
      constructor.then = (
        resolver: (valor: { data: unknown[]; error: null }) => void,
      ) => {
        const seleccion = String(
          consulta.llamadas.find((l) => l.metodo === "select")?.args[0],
        );
        const data = seleccion.includes("avance_seccion")
          ? respuestas.ordenes
          : respuestas.enlaces;
        resolver({ data, error: null });
      };
      return constructor;
    },
  }),
}));

import {
  listarOrdenesTablero,
  obtenerDetalleOrden,
} from "@/lib/ordenes/estadoOrden";

const ID_ORIGINAL = "00000000-0000-0000-0000-0000000000f7";
const ID_CORRECCION = "00000000-0000-0000-0000-0000000000fb";
const ID_SUELTA = "00000000-0000-0000-0000-0000000000f1";

function fila(id: string, numero: string, original: string | null) {
  return {
    id,
    numero_orden_compra: numero,
    fecha_ingreso: "2026-09-01",
    fecha_entrega: "2026-10-30",
    etapa_inicial: original ? "corte_completado" : null,
    orden_original_id: original,
    cliente: { razon_social: "Colegio" },
    item_orden: [],
    lote_taller: [],
    avance_seccion: [],
    reproceso: [],
    ficha_tecnica: [],
  };
}

function llamadasDe(consulta: Consulta, metodo: string) {
  return consulta.llamadas.filter((l) => l.metodo === metodo);
}

const esDeEnlaces = (c: Consulta) =>
  c.llamadas.some(
    (l) =>
      l.metodo === "select" &&
      l.args[0] === "id, numero_orden_compra, orden_original_id",
  );

beforeEach(() => {
  consultas.length = 0;
});

describe("el tablero", () => {
  it("resuelve los enlaces con las mismas filas: una sola consulta", async () => {
    respuestas.ordenes = [
      fila(ID_ORIGINAL, "OC-5007", null),
      fila(ID_CORRECCION, "OC-5007-C1", ID_ORIGINAL),
    ];

    const ordenes = await listarOrdenesTablero();

    expect(consultas).toHaveLength(1);
    expect(consultas.some(esDeEnlaces)).toBe(false);

    const original = ordenes.find((o) => o.id === ID_ORIGINAL);
    const correccion = ordenes.find((o) => o.id === ID_CORRECCION);
    expect(original?.correcciones).toEqual([
      { id: ID_CORRECCION, numeroOrdenCompra: "OC-5007-C1" },
    ]);
    expect(correccion?.ordenOriginal).toEqual({
      id: ID_ORIGINAL,
      numeroOrdenCompra: "OC-5007",
    });
  });
});

describe("el semáforo del tablero", () => {
  const cerrada = (anuladoPor: string | null) => ({
    checkpoint: "cerrada",
    usuario_id: "u1",
    fecha_hora: "2026-09-02T10:00:00Z",
    observaciones: null,
    anulado_por: anuladoPor,
    usuario: { nombre: "Paula" },
  });

  it("una orden con la etapa cerrada vigente es entregada aunque su fecha ya pasó", async () => {
    respuestas.ordenes = [
      {
        ...fila(ID_SUELTA, "OC-5001", null),
        fecha_entrega: "2026-09-05",
        avance_seccion: [cerrada(null)],
      },
    ];

    const [orden] = await listarOrdenesTablero();

    expect(orden.semaforo).toBe("entregada");
  });

  it("si el cierre fue anulado, la fecha vencida sí la deja atrasada", async () => {
    respuestas.ordenes = [
      {
        ...fila(ID_SUELTA, "OC-5001", null),
        fecha_entrega: "2026-09-05",
        avance_seccion: [cerrada("d1")],
      },
    ];

    const [orden] = await listarOrdenesTablero();

    expect(orden.semaforo).toBe("atrasada");
  });
});

describe("el detalle de una orden", () => {
  it("de una orden sin original pide solo sus correcciones", async () => {
    respuestas.ordenes = [fila(ID_SUELTA, "OC-5001", null)];
    respuestas.enlaces = [];

    await obtenerDetalleOrden(ID_SUELTA);

    const enlaces = consultas.filter(esDeEnlaces);
    expect(enlaces).toHaveLength(1);
    expect(llamadasDe(enlaces[0], "eq")).toEqual([
      { metodo: "eq", args: ["orden_original_id", ID_SUELTA] },
    ]);
  });

  it("de una corrección pide solo su original y sus propias correcciones", async () => {
    respuestas.ordenes = [fila(ID_CORRECCION, "OC-5007-C1", ID_ORIGINAL)];
    respuestas.enlaces = [fila(ID_ORIGINAL, "OC-5007", null)];

    const detalle = await obtenerDetalleOrden(ID_CORRECCION);

    const enlaces = consultas.filter(esDeEnlaces);
    expect(enlaces).toHaveLength(1);
    expect(llamadasDe(enlaces[0], "or")).toEqual([
      {
        metodo: "or",
        args: [`id.eq.${ID_ORIGINAL},orden_original_id.eq.${ID_CORRECCION}`],
      },
    ]);
    expect(detalle?.ordenOriginal?.numeroOrdenCompra).toBe("OC-5007");
  });

  it("de una orden que no existe no pide enlaces", async () => {
    respuestas.ordenes = [];

    expect(await obtenerDetalleOrden(ID_SUELTA)).toBeNull();
    expect(consultas.some(esDeEnlaces)).toBe(false);
  });
});
