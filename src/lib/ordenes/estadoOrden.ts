import "server-only";

import {
  armarEtapas,
  contarProgreso,
  derivarSemaforo,
  resumirTablero,
} from "@/lib/ordenes/reglas";
import type {
  AvanceAnulado,
  AvanceSeccion,
  Devolucion,
  DetalleOrden,
  EnlaceOrden,
  OrdenEnTablero,
  OrdenResumen,
  ResumenTablero,
} from "@/lib/ordenes/types";
import { firmarFichas } from "@/lib/storage/firmarFichas";
import { createClient } from "@/lib/supabase/server";
import { describirEstadoDeTalleres } from "@/lib/talleres/estadoLotes";

/**
 * El estado de una orden, leído de la base y derivado (HU-14, HU-15). Se
 * deriva de `avance_seccion`, de los lotes y de las fechas; no hay columna
 * `estado` (regla 1).
 *
 * Vive en `lib/` y no en la feature `tablero` porque lo necesitan dos
 * features: el tablero lo pinta y el asistente (HU-15) lo cuenta. Una feature
 * no importa de otra (ADR 0003).
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
  etapa_inicial,
  orden_original_id,
  cliente ( razon_social ),
  item_orden ( descripcion, cantidad ),
  lote_taller ( taller, fecha_envio, recibido_completo ),
  avance_seccion (
    checkpoint,
    usuario_id,
    fecha_hora,
    observaciones,
    anulado_por,
    usuario ( nombre )
  ),
  reproceso (
    id,
    checkpoint_destino,
    motivo,
    creado_en,
    usuario:creado_por ( nombre )
  ),
  ficha_tecnica (
    id,
    archivo_ruta,
    fecha_subida,
    usuario:subida_por ( nombre )
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

/**
 * El número de cada orden y a cuál corrige (HU-18), para mostrar el enlace en
 * los dos sentidos. Se lee aparte porque el enlace es una relación de la tabla
 * consigo misma y así el tipo de las demás filas no depende de cómo la resuelve
 * la API. Son pocas filas: una orden por pedido de un taller de ~15 personas.
 */
async function leerEnlaces(): Promise<{
  numeros: Map<string, string>;
  correccionesDe: Map<string, EnlaceOrden[]>;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orden")
    .select("id, numero_orden_compra, orden_original_id")
    .order("numero_orden_compra", { ascending: true });

  if (error) {
    throw new Error(`No se pudieron leer los enlaces: ${error.message}`);
  }

  const numeros = new Map(data.map((o) => [o.id, o.numero_orden_compra]));
  const correccionesDe = new Map<string, EnlaceOrden[]>();
  for (const orden of data) {
    if (!orden.orden_original_id) continue;
    correccionesDe.set(orden.orden_original_id, [
      ...(correccionesDe.get(orden.orden_original_id) ?? []),
      { id: orden.id, numeroOrdenCompra: orden.numero_orden_compra },
    ]);
  }
  return { numeros, correccionesDe };
}

type Enlaces = Awaited<ReturnType<typeof leerEnlaces>>;

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

function aAvance(fila: OrdenFila["avance_seccion"][number]): AvanceSeccion {
  return {
    seccion: fila.checkpoint,
    usuarioId: fila.usuario_id,
    usuarioNombre: fila.usuario?.nombre ?? "Sin nombre",
    fechaHora: fila.fecha_hora,
    observacion: fila.observaciones ?? undefined,
  };
}

/**
 * Los avances VIGENTES de la orden: son los que cuentan para su estado. Los que
 * una devolución anuló (HU-18) siguen en la bitácora y salen por `anuladosDe`.
 */
function avancesDe(filas: OrdenFila["avance_seccion"]): AvanceSeccion[] {
  return filas
    .filter((fila) => fila.anulado_por === null)
    .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))
    .map(aAvance);
}

function anuladosDe(filas: OrdenFila["avance_seccion"]): AvanceAnulado[] {
  return filas.flatMap((fila) =>
    fila.anulado_por === null
      ? []
      : [{ ...aAvance(fila), devolucionId: fila.anulado_por }],
  );
}

function devolucionesDe(filas: OrdenFila["reproceso"]): Devolucion[] {
  return [...filas]
    .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
    .map((fila) => ({
      id: fila.id,
      destino: fila.checkpoint_destino,
      motivo: fila.motivo,
      porNombre: fila.usuario?.nombre ?? "Sin nombre",
      fechaHora: fila.creado_en,
    }));
}

function resumenDe(fila: OrdenFila, enlaces: Enlaces): OrdenResumen {
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
    lotesEnTaller: fila.lote_taller.filter(
      (lote) => lote.recibido_completo === null,
    ).length,
    tieneFicha: fila.ficha_tecnica.length > 0,
    etapaInicial: fila.etapa_inicial,
    ordenOriginal: fila.orden_original_id
      ? {
          id: fila.orden_original_id,
          numeroOrdenCompra:
            enlaces.numeros.get(fila.orden_original_id) ?? "Orden original",
        }
      : null,
    correcciones: enlaces.correccionesDe.get(fila.id) ?? [],
    devoluciones: devolucionesDe(fila.reproceso),
  };
}

function enriquecer(fila: OrdenFila, enlaces: Enlaces): OrdenEnTablero {
  const avances = avancesDe(fila.avance_seccion);
  const etapas = armarEtapas(
    avances,
    anuladosDe(fila.avance_seccion),
    fila.etapa_inicial,
  );
  const cabecera = resumenDe(fila, enlaces);
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
  const [filas, enlaces] = await Promise.all([leerOrdenes(), leerEnlaces()]);
  return filas.map((fila) => enriquecer(fila, enlaces));
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
  const [[fila], enlaces] = await Promise.all([
    leerOrdenes(ordenId),
    leerEnlaces(),
  ]);
  if (!fila) return null;

  const supabase = await createClient();

  return {
    ...enriquecer(fila, enlaces),
    avances: avancesDe(fila.avance_seccion),
    fichas: await firmarFichas(supabase, fila.ficha_tecnica),
  };
}
