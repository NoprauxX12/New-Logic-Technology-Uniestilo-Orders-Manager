import "server-only";

import {
  armarEtapas,
  derivarSemaforo,
  resumirTablero,
} from "@/features/tablero/reglas";
import type {
  AvanceSeccion,
  DetalleOrden,
  OrdenEnTablero,
  OrdenResumen,
  ResumenTablero,
} from "@/features/tablero/types";

/**
 * Capa de lectura del tablero (HU-14).
 *
 * Hoy: datos mock en memoria.
 * Luego: reemplazar el cuerpo de estas funciones con Supabase
 * (`createClient` de `@/lib/supabase/server`) sin cambiar los componentes.
 *
 * Reglas puras (semáforo, etapas, resumen) viven en `reglas.ts`.
 */

function enriquecer(
  orden: OrdenResumen,
  avances: AvanceSeccion[],
): OrdenEnTablero {
  const etapas = armarEtapas(avances);
  return {
    ...orden,
    semaforo: derivarSemaforo(orden.fechaEntrega),
    etapas,
    etapasCompletadas: etapas.filter((e) => e.estado === "completada").length,
    etapasTotales: etapas.length,
  };
}

// --- Mock temporal (borrar cuando exista la BD) -------------------------------

const MOCK_ORDENES: OrdenResumen[] = [
  {
    id: "ord-089",
    numeroOrden: "ORD-2024-089",
    numeroOrdenCompra: "OC-4412",
    razonSocial: "Almacenes Éxito S.A.",
    prenda: "Camisas ejecutivas",
    cantidad: 240,
    fechaRecepcion: "2024-07-01",
    fechaEntrega: "2024-07-28",
    tallerNombre: "Taller Fontibón",
    ubicacionEntrega: "Fontibón",
  },
  {
    id: "ord-092",
    numeroOrden: "ORD-2024-092",
    numeroOrdenCompra: "OC-4480",
    razonSocial: "Universidad EAFIT",
    prenda: "Uniformes deportivos",
    cantidad: 120,
    fechaRecepcion: "2024-07-10",
    fechaEntrega: "2026-09-08",
    tallerNombre: "Taller Marinilla",
    ubicacionEntrega: "Medellín",
  },
];

const MOCK_AVANCES: Record<string, AvanceSeccion[]> = {
  "ord-089": [
    {
      seccion: "contacto",
      usuarioId: "u-sec",
      usuarioNombre: "Laura Secretaría",
      fechaHora: "2024-07-01T09:00:00",
      observacion: "Cliente confirmó paleta de colores.",
    },
    {
      seccion: "recepcion",
      usuarioId: "u-sec",
      usuarioNombre: "Laura Secretaría",
      fechaHora: "2024-07-01T14:30:00",
    },
    {
      seccion: "validacion",
      usuarioId: "u-sec",
      usuarioNombre: "Laura Secretaría",
      fechaHora: "2024-07-02T10:00:00",
    },
    {
      seccion: "ficha_tecnica",
      usuarioId: "u-dis",
      usuarioNombre: "Ana Diseño",
      fechaHora: "2024-07-03T16:00:00",
    },
    {
      seccion: "programacion",
      usuarioId: "u-sec",
      usuarioNombre: "Laura Secretaría",
      fechaHora: "2024-07-04T11:00:00",
    },
    {
      seccion: "trazo_corte",
      usuarioId: "u-cor",
      usuarioNombre: "Carlos Corte",
      fechaHora: "2024-07-08T17:00:00",
    },
    {
      seccion: "bordado_estampado",
      usuarioId: "u-log",
      usuarioNombre: "Pedro Logística",
      fechaHora: "2024-07-10T12:00:00",
    },
    {
      seccion: "despacho_satelites",
      usuarioId: "u-log",
      usuarioNombre: "Pedro Logística",
      fechaHora: "2024-07-11T08:00:00",
    },
  ],
  "ord-092": [
    {
      seccion: "contacto",
      usuarioId: "u-sec",
      usuarioNombre: "Laura Secretaría",
      fechaHora: "2024-07-10T09:00:00",
    },
    {
      seccion: "recepcion",
      usuarioId: "u-sec",
      usuarioNombre: "Laura Secretaría",
      fechaHora: "2024-07-10T15:00:00",
    },
  ],
};

// --- API pública de la feature ------------------------------------------------

export async function listarOrdenesTablero(): Promise<OrdenEnTablero[]> {
  // TODO(BD): select orden + avances; enriquecer en memoria
  return MOCK_ORDENES.map((o) => enriquecer(o, MOCK_AVANCES[o.id] ?? []));
}

export async function obtenerResumenTablero(
  ordenes?: OrdenEnTablero[],
): Promise<ResumenTablero> {
  const filas = ordenes ?? (await listarOrdenesTablero());
  return resumirTablero(filas);
}

export async function obtenerDetalleOrden(
  ordenId: string,
): Promise<DetalleOrden | null> {
  // TODO(BD): select por id; 404 si no existe
  const orden = MOCK_ORDENES.find((o) => o.id === ordenId);
  if (!orden) return null;

  const avances = MOCK_AVANCES[orden.id] ?? [];
  return {
    ...enriquecer(orden, avances),
    avances,
  };
}
