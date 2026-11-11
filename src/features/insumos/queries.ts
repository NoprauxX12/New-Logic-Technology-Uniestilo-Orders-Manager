import "server-only";

import {
  CHECKPOINT_INSUMOS,
  listadoVigente,
  type InsumoDelListado,
} from "@/features/insumos/reglas";
import type { Rol } from "@/features/workflow/checkpoints";
import {
  obtenerOrdenesParaSeccion,
  type OrdenParaSeccion,
} from "@/features/workflow/queries";
import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-23 · Lecturas de la validación de insumos.
 *
 * La lista de trabajo es la misma de cualquier sección (qué toca, qué no ha
 * llegado, qué se hizo esta semana) más lo que esta pantalla necesita de cada
 * orden: las prendas de la orden de compra, que es de donde sale el listado, y
 * el listado ya validado.
 */

/** Una prenda de la orden de compra, como se lee para sacar los insumos. */
export type PrendaDeLaOrden = {
  id: string;
  descripcion: string;
  cantidad: number;
  tallas: string;
  observaciones: string | null;
};

export type OrdenParaInsumos = OrdenParaSeccion & {
  prendas: PrendaDeLaOrden[];
  /** El listado vigente; vacío mientras no se validen los insumos. */
  listado: InsumoDelListado[];
};

type FilaInsumo = {
  insumo: InsumoDelListado["insumo"];
  detalle: string;
  avance_seccion: { anulado_por: string | null } | null;
};

function aListado(filas: readonly FilaInsumo[]): InsumoDelListado[] {
  return listadoVigente(
    filas.map((fila) => ({
      insumo: fila.insumo,
      detalle: fila.detalle,
      avance: fila.avance_seccion
        ? { anuladoPor: fila.avance_seccion.anulado_por }
        : null,
    })),
  );
}

function aPrenda(fila: PrendaDeLaOrden): PrendaDeLaOrden {
  return {
    id: fila.id,
    descripcion: fila.descripcion,
    cantidad: fila.cantidad,
    tallas: fila.tallas,
    observaciones: fila.observaciones,
  };
}

export async function listarOrdenesParaInsumos(
  rol: Rol,
): Promise<OrdenParaInsumos[]> {
  const ordenes = await obtenerOrdenesParaSeccion(CHECKPOINT_INSUMOS, rol);
  // Las cerradas no aparecen en ninguna lista: no hace falta leer sus prendas.
  const abiertas = ordenes.filter((orden) => !orden.cerrada);

  if (abiertas.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       item_orden ( id, descripcion, cantidad, tallas, observaciones ),
       insumo_orden ( insumo, detalle, avance_seccion ( anulado_por ) )`,
    )
    .in(
      "id",
      abiertas.map((orden) => orden.id),
    );

  if (error) {
    console.error("[HU-23] No se pudieron leer las prendas e insumos", error);
    throw new Error("No se pudieron leer los insumos de las órdenes.");
  }

  const porOrden = new Map(data.map((fila) => [fila.id, fila]));

  return abiertas.map((orden) => {
    const fila = porOrden.get(orden.id);
    return {
      ...orden,
      prendas: (fila?.item_orden ?? []).map(aPrenda),
      listado: aListado(fila?.insumo_orden ?? []),
    };
  });
}

/** Lo que va en el listado impreso de una orden. */
export type ListadoDeInsumos = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  nit: string;
  contactoNombre: string;
  contactoCelular: string;
  fechaIngreso: string;
  fechaEntrega: string;
  observaciones: string | null;
  prendas: PrendaDeLaOrden[];
  listado: InsumoDelListado[];
  /** Quién y cuándo validó, si ya se validó. */
  validacion: { por: string; fechaHora: string } | null;
};

/** El listado de insumos de una orden, o `null` si la orden no existe. */
export async function obtenerListadoDeInsumos(
  ordenId: string,
): Promise<ListadoDeInsumos | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(
      `id,
       numero_orden_compra,
       fecha_ingreso,
       fecha_entrega,
       observaciones,
       cliente ( razon_social, nit, contacto_nombre, contacto_celular ),
       item_orden ( id, descripcion, cantidad, tallas, observaciones ),
       insumo_orden ( insumo, detalle, avance_seccion ( anulado_por ) ),
       avance_seccion ( checkpoint, fecha_hora, usuario ( nombre ) )`,
    )
    .eq("id", ordenId)
    .is(AVANCE_VIGENTE, null)
    .maybeSingle();

  if (error) {
    console.error("[HU-23] No se pudo leer el listado de insumos", error);
    throw new Error("No se pudo leer el listado de insumos.");
  }

  if (!data) return null;

  const avance = data.avance_seccion.find(
    (candidato) => candidato.checkpoint === CHECKPOINT_INSUMOS,
  );

  return {
    id: data.id,
    numeroOrdenCompra: data.numero_orden_compra,
    razonSocial: data.cliente?.razon_social ?? "Cliente sin nombre",
    nit: data.cliente?.nit ?? "",
    contactoNombre: data.cliente?.contacto_nombre ?? "",
    contactoCelular: data.cliente?.contacto_celular ?? "",
    fechaIngreso: data.fecha_ingreso,
    fechaEntrega: data.fecha_entrega,
    observaciones: data.observaciones,
    prendas: data.item_orden.map(aPrenda),
    listado: aListado(data.insumo_orden),
    validacion: avance
      ? {
          por: avance.usuario?.nombre ?? "Secretaría",
          fechaHora: avance.fecha_hora,
        }
      : null,
  };
}
