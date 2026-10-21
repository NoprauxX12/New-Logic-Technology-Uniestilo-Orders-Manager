import { loQueSigue } from "@/features/workflow/estado";
import { diasHasta } from "@/lib/ordenes/reglas";
import type { OrdenEnTablero } from "@/lib/ordenes/types";

/**
 * Filtros y orden de las listas de órdenes. Los usan el tablero (HU-14) y el
 * asistente (HU-15); por eso viven en `lib/` y no en una feature. Puros: sin
 * I/O, se prueban con stubs.
 */

export type FiltroOrdenes =
  | "todas"
  | "atrasadas"
  | "en_riesgo"
  | "en_produccion"
  | "sin_empezar"
  | "terminadas";

export const FILTROS_ORDENES: readonly FiltroOrdenes[] = [
  "todas",
  "atrasadas",
  "en_riesgo",
  "en_produccion",
  "sin_empezar",
  "terminadas",
];

/**
 * Sin tildes ni virgulillas, sin mayúsculas y sin espacios de sobra, para
 * comparar lo que escribe la persona con lo que hay en la base.
 */
export function normalizar(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // Los modelos escriben "OC‑5003" con guion no separable; en la base es "-".
      .replace(/[‐-―−]/g, "-")
      .toLowerCase()
      .trim()
  );
}

/**
 * Las órdenes cuyo número de orden de compra o cliente contienen el texto.
 * "5003" encuentra "OC-5003"; "colegio" encuentra "Colegio San José".
 */
export function filtrarOrdenes(
  ordenes: readonly OrdenEnTablero[],
  texto: string,
): OrdenEnTablero[] {
  const buscado = normalizar(texto);
  if (!buscado) return [];

  return ordenes.filter(
    (orden) =>
      normalizar(orden.numeroOrdenCompra).includes(buscado) ||
      normalizar(orden.razonSocial).includes(buscado),
  );
}

export function filtrarPorEstado(
  ordenes: readonly OrdenEnTablero[],
  filtro: FiltroOrdenes,
): OrdenEnTablero[] {
  switch (filtro) {
    case "todas":
      return [...ordenes];
    case "atrasadas":
      return ordenes.filter((orden) => orden.semaforo === "atrasada");
    case "en_riesgo":
      return ordenes.filter((orden) => orden.semaforo === "en_riesgo");
    case "en_produccion":
      return ordenes.filter(
        (orden) =>
          orden.etapasCompletadas > 0 &&
          orden.etapasCompletadas < orden.etapasTotales,
      );
    case "sin_empezar":
      return ordenes.filter((orden) => orden.etapasCompletadas === 0);
    case "terminadas":
      return ordenes.filter(
        (orden) =>
          orden.etapasTotales > 0 &&
          orden.etapasCompletadas === orden.etapasTotales,
      );
  }
}

// ---------------------------------------------------------------------------
// Tablero (HU-14): filtros rápidos, "dónde está" y orden por urgencia.
// ---------------------------------------------------------------------------

/** Cuántos días hacia adelante cuenta "entrega esta semana" (hoy incluido). */
export const DIAS_ENTREGA_SEMANA = 7;

export type FiltroRapido = "atrasadas" | "en_riesgo" | "esta_semana";
export const FILTROS_RAPIDOS: readonly FiltroRapido[] = [
  "atrasadas",
  "en_riesgo",
  "esta_semana",
];

/** La sección donde está parada la orden: a quien le toca mover algo. */
export type Donde = "corte" | "bordado" | "taller" | "marcacion";
export const DONDES: readonly Donde[] = [
  "corte",
  "bordado",
  "taller",
  "marcacion",
];

export type FiltrosTablero = {
  q: string;
  filtro: FiltroRapido | null;
  donde: Donde | null;
};

export const SIN_FILTROS: FiltrosTablero = { q: "", filtro: null, donde: null };

export function hayFiltros(filtros: FiltrosTablero): boolean {
  return (
    filtros.q.trim() !== "" || filtros.filtro !== null || filtros.donde !== null
  );
}

function unico(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? "");
}

/** Lee `?q=&filtro=&donde=` de la URL; lo que no se reconoce se ignora. */
export function leerFiltros(
  params: Record<string, string | string[] | undefined>,
): FiltrosTablero {
  const filtro = unico(params.filtro);
  const donde = unico(params.donde);
  return {
    q: unico(params.q).trim().slice(0, 80),
    filtro: (FILTROS_RAPIDOS as readonly string[]).includes(filtro)
      ? (filtro as FiltroRapido)
      : null,
    donde: (DONDES as readonly string[]).includes(donde)
      ? (donde as Donde)
      : null,
  };
}

/** Dónde está parada la orden, o null si ya terminó o está en otra sección. */
export function dondeEsta(orden: OrdenEnTablero): Donde | null {
  // Con lotes sin recibir, la orden está en el taller aunque lo siguiente
  // que se marque sea la llegada a marcación.
  if (orden.lotesEnTaller > 0) return "taller";

  const sigue = loQueSigue(
    orden.etapas
      .filter((etapa) => etapa.estado === "completada")
      .map((etapa) => etapa.seccion),
    orden.etapaInicial,
  );
  switch (sigue?.checkpoint.id) {
    case "corte_completado":
      return "corte";
    case "recogido_bordado":
      return "bordado";
    case "llegada_marcacion":
      return "marcacion";
    default:
      return null;
  }
}

function cumpleRapido(
  orden: OrdenEnTablero,
  filtro: FiltroRapido,
  ahora: Date,
): boolean {
  switch (filtro) {
    case "atrasadas":
      return orden.semaforo === "atrasada";
    case "en_riesgo":
      return orden.semaforo === "en_riesgo";
    case "esta_semana": {
      const dias = diasHasta(orden.fechaEntrega, ahora);
      return dias >= 0 && dias <= DIAS_ENTREGA_SEMANA;
    }
  }
}

/** Búsqueda del tablero: texto vacío no filtra (a diferencia de `filtrarOrdenes`). */
function buscar(
  ordenes: readonly OrdenEnTablero[],
  q: string,
): OrdenEnTablero[] {
  return normalizar(q) ? filtrarOrdenes(ordenes, q) : [...ordenes];
}

const RANGO_SEMAFORO = { atrasada: 0, en_riesgo: 1, a_tiempo: 2 } as const;

/** Atrasadas primero, luego en riesgo, luego por fecha de entrega ascendente. */
export function ordenarPorUrgencia(
  ordenes: readonly OrdenEnTablero[],
): OrdenEnTablero[] {
  return [...ordenes].sort(
    (a, b) =>
      RANGO_SEMAFORO[a.semaforo] - RANGO_SEMAFORO[b.semaforo] ||
      a.fechaEntrega.localeCompare(b.fechaEntrega) ||
      a.numeroOrdenCompra.localeCompare(b.numeroOrdenCompra),
  );
}

export function filtrarTablero(
  ordenes: readonly OrdenEnTablero[],
  filtros: FiltrosTablero,
  ahora = new Date(),
): OrdenEnTablero[] {
  return ordenarPorUrgencia(
    buscar(ordenes, filtros.q).filter(
      (orden) =>
        (filtros.filtro === null ||
          cumpleRapido(orden, filtros.filtro, ahora)) &&
        (filtros.donde === null || dondeEsta(orden) === filtros.donde),
    ),
  );
}

export type ConteosTablero = {
  filtro: Record<FiltroRapido, number>;
  donde: Record<Donde, number>;
};

/** Lo que muestra cada botón: cuántas órdenes del texto buscado caen en él. */
export function contarFiltros(
  ordenes: readonly OrdenEnTablero[],
  q: string,
  ahora = new Date(),
): ConteosTablero {
  const base = buscar(ordenes, q);
  const cuantas = (f: (o: OrdenEnTablero) => boolean) => base.filter(f).length;
  return {
    filtro: {
      atrasadas: cuantas((o) => cumpleRapido(o, "atrasadas", ahora)),
      en_riesgo: cuantas((o) => cumpleRapido(o, "en_riesgo", ahora)),
      esta_semana: cuantas((o) => cumpleRapido(o, "esta_semana", ahora)),
    },
    donde: {
      corte: cuantas((o) => dondeEsta(o) === "corte"),
      bordado: cuantas((o) => dondeEsta(o) === "bordado"),
      taller: cuantas((o) => dondeEsta(o) === "taller"),
      marcacion: cuantas((o) => dondeEsta(o) === "marcacion"),
    },
  };
}
