import "server-only";

import {
  armarEtapas,
  contarProgreso,
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
import { createClient } from "@/lib/supabase/server";
import { describirEstadoDeTalleres } from "@/lib/talleres/estadoLotes";

/**
 * Lectura del tablero (HU-14). El estado de cada orden se deriva de
 * `avance_seccion`, de los lotes y de las fechas; no hay columna `estado`
 * (regla 1).
 *
 * La forma de las filas la infiere el cliente de Supabase a partir de
 * `database.types.ts` y del `select`: no se escribe a mano ni se fuerza con un
 * cast, para que un cambio de esquema se note al compilar.
 */

const SELECCION_ORDEN = `
  id,
  numero_orden_compra,
  fecha_ingreso,
  fecha_entrega,
  cliente ( razon_social ),
  item_orden ( descripcion, cantidad ),
  lote_taller ( taller, fecha_envio, recibido_completo ),
  avance_seccion (
    checkpoint,
    usuario_id,
    fecha_hora,
    observaciones,
    usuario ( nombre )
  )
` as const;

async function leerOrdenes(ordenId?: string) {
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

  return data;
}

type OrdenFila = Awaited<ReturnType<typeof leerOrdenes>>[number];

function prendasDe(items: OrdenFila["item_orden"]): {
  prenda: string;
  cantidad: number;
} {
  if (items.length === 0) {
    return { prenda: "—", cantidad: 0 };
  }

  return {
    prenda: items.map((item) => item.descripcion).join(" · "),
    cantidad: items.reduce((total, item) => total + item.cantidad, 0),
  };
}

function tallerDe(lotes: OrdenFila["lote_taller"]): string | null {
  if (lotes.length === 0) return null;

  const porEnvio = [...lotes].sort((a, b) =>
    b.fecha_envio.localeCompare(a.fecha_envio),
  );
  return [...new Set(porEnvio.map((lote) => lote.taller))].join(", ");
}

function avancesDe(filas: OrdenFila["avance_seccion"]): AvanceSeccion[] {
  return [...filas]
    .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
    .map((fila) => ({
      seccion: fila.checkpoint,
      usuarioId: fila.usuario_id,
      usuarioNombre: fila.usuario?.nombre ?? "Sin nombre",
      fechaHora: fila.fecha_hora,
      observacion: fila.observaciones ?? undefined,
    }));
}

function resumenDe(fila: OrdenFila): OrdenResumen {
  const { prenda, cantidad } = prendasDe(fila.item_orden);

  return {
    id: fila.id,
    numeroOrdenCompra: fila.numero_orden_compra,
    razonSocial: fila.cliente?.razon_social ?? "Sin cliente",
    prenda,
    cantidad,
    fechaRecepcion: fila.fecha_ingreso,
    fechaEntrega: fila.fecha_entrega,
    tallerNombre: tallerDe(fila.lote_taller),
    estadoTalleres: describirEstadoDeTalleres(
      fila.lote_taller.map((lote) => ({
        recibido: lote.recibido_completo !== null,
      })),
    ),
  };
}

function enriquecer(fila: OrdenFila): OrdenEnTablero {
  const avances = avancesDe(fila.avance_seccion);
  const etapas = armarEtapas(avances);
  const cabecera = resumenDe(fila);
  const { completadas, totales } = contarProgreso(etapas);

  return {
    ...cabecera,
    semaforo: derivarSemaforo(cabecera.fechaEntrega),
    etapas,
    etapasCompletadas: completadas,
    etapasTotales: totales,
  };
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
