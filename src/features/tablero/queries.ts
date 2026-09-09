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
import type { CheckpointId } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/**
 * Lectura del tablero (HU-14). El estado de cada orden se deriva de
 * `avance_seccion` + fechas; no hay columna `estado` (regla 1).
 */

const SELECCION_ORDEN = `
  id,
  numero_orden_compra,
  fecha_ingreso,
  fecha_entrega,
  cliente ( razon_social ),
  item_orden ( descripcion, cantidad ),
  lote_taller ( taller, fecha_envio ),
  avance_seccion (
    checkpoint,
    usuario_id,
    fecha_hora,
    observaciones,
    usuario ( nombre )
  )
`;

type Relacion<T> = T | T[] | null;

type ClienteFila = { razon_social: string };
type ItemFila = { descripcion: string; cantidad: number };
type LoteFila = { taller: string; fecha_envio: string };
type UsuarioFila = { nombre: string };
type AvanceFila = {
  checkpoint: CheckpointId;
  usuario_id: string;
  fecha_hora: string;
  observaciones: string | null;
  usuario: Relacion<UsuarioFila>;
};

type OrdenFila = {
  id: string;
  numero_orden_compra: string;
  fecha_ingreso: string;
  fecha_entrega: string;
  cliente: Relacion<ClienteFila>;
  item_orden: ItemFila[] | null;
  lote_taller: LoteFila[] | null;
  avance_seccion: AvanceFila[] | null;
};

function uno<T>(valor: Relacion<T>): T | null {
  if (valor == null) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function prendasDe(items: ItemFila[] | null): {
  prenda: string;
  cantidad: number;
} {
  if (!items || items.length === 0) {
    return { prenda: "—", cantidad: 0 };
  }

  return {
    prenda: items.map((item) => item.descripcion).join(" · "),
    cantidad: items.reduce((total, item) => total + item.cantidad, 0),
  };
}

function tallerDe(lotes: LoteFila[] | null): string | null {
  if (!lotes || lotes.length === 0) return null;

  const porEnvio = [...lotes].sort((a, b) =>
    b.fecha_envio.localeCompare(a.fecha_envio),
  );
  return [...new Set(porEnvio.map((lote) => lote.taller))].join(", ");
}

function avancesDe(filas: AvanceFila[] | null): AvanceSeccion[] {
  if (!filas) return [];

  return [...filas]
    .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
    .map((fila) => ({
      seccion: fila.checkpoint,
      usuarioId: fila.usuario_id,
      usuarioNombre: uno(fila.usuario)?.nombre ?? "Sin nombre",
      fechaHora: fila.fecha_hora,
      observacion: fila.observaciones ?? undefined,
    }));
}

function resumenDe(fila: OrdenFila): OrdenResumen {
  const { prenda, cantidad } = prendasDe(fila.item_orden);

  return {
    id: fila.id,
    numeroOrdenCompra: fila.numero_orden_compra,
    razonSocial: uno(fila.cliente)?.razon_social ?? "Sin cliente",
    prenda,
    cantidad,
    fechaRecepcion: fila.fecha_ingreso,
    fechaEntrega: fila.fecha_entrega,
    tallerNombre: tallerDe(fila.lote_taller),
  };
}

function enriquecer(fila: OrdenFila): OrdenEnTablero {
  const avances = avancesDe(fila.avance_seccion);
  const etapas = armarEtapas(avances);
  const cabecera = resumenDe(fila);

  return {
    ...cabecera,
    semaforo: derivarSemaforo(cabecera.fechaEntrega),
    etapas,
    etapasCompletadas: etapas.filter((etapa) => etapa.estado === "completada")
      .length,
    etapasTotales: etapas.length,
  };
}

async function leerOrdenes(ordenId?: string): Promise<OrdenFila[]> {
  const supabase = await createClient();
  let consulta = supabase
    .from("orden")
    .select(SELECCION_ORDEN)
    .order("fecha_entrega", { ascending: true });

  if (ordenId) {
    consulta = consulta.eq("id", ordenId);
  }

  const { data, error } = await consulta;

  if (error) {
    throw new Error(`No se pudieron leer las órdenes: ${error.message}`);
  }

  return (data ?? []) as OrdenFila[];
}

export async function listarOrdenesTablero(): Promise<OrdenEnTablero[]> {
  const filas = await leerOrdenes();
  return filas.map(enriquecer);
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
  const [fila] = await leerOrdenes(ordenId);
  if (!fila) return null;

  return {
    ...enriquecer(fila),
    avances: avancesDe(fila.avance_seccion),
  };
}
