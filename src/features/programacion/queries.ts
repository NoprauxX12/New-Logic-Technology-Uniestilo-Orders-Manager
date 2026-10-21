import "server-only";

import {
  puedeProgramar,
  ROL_DE_PROGRAMACION,
  totalDePrendas,
} from "@/features/programacion/reglas";
import type { CheckpointId } from "@/features/workflow/checkpoints";
import { AVANCE_VIGENTE } from "@/lib/ordenes/vigentes";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-03 · Lecturas de la programación a diseño.
 *
 * Dos consultas: las órdenes que todavía no se han programado —lo que la
 * secretaria va agregando— y las hojas ya armadas, que es lo que diseño
 * trabaja.
 *
 * Las dos traen `descripcion` y `cantidad` de cada prenda, que es lo que la
 * historia llama referencia y total por referencia. **Ni `tallas` ni `valor`
 * entran en el `select`**: la historia dice explícitamente que no van, y no
 * pedirlos es más fuerte que ocultarlos en la pantalla.
 */

/** Una referencia de la orden, con su total. Sin tallas y sin valor. */
export type ReferenciaDeLaOrden = {
  id: string;
  descripcion: string;
  cantidad: number;
};

export type OrdenPorProgramar = {
  id: string;
  numeroOrdenCompra: string;
  razonSocial: string;
  fechaIngreso: string;
  fechaEntrega: string;
  referencias: ReferenciaDeLaOrden[];
  /** La suma de las referencias, para decidir sin abrir la orden. */
  totalPrendas: number;
  /** Todo lo que lleva marcado, para que las reglas decidan. */
  marcados: CheckpointId[];
};

export type OrdenEnLaHoja = OrdenPorProgramar & {
  /** Su turno dentro de la hoja. */
  turno: number;
};

/** Una hoja de programación completa, como la de papel. */
export type HojaDeProgramacion = {
  numero: number;
  ordenes: OrdenEnLaHoja[];
  /** El total de prendas de toda la hoja, como el número del pie de la hoja. */
  totalPrendas: number;
  /** Cuándo y quién la programó, de la bitácora. */
  programadaEn: string | null;
  programadaPor: string | null;
};

const SELECCION = `id,
   numero_orden_compra,
   fecha_ingreso,
   fecha_entrega,
   numero_orden_programacion,
   posicion_programacion,
   cliente ( razon_social ),
   item_orden ( id, descripcion, cantidad ),
   avance_seccion ( checkpoint, fecha_hora, usuario ( nombre ) )`;

type FilaOrden = {
  id: string;
  numero_orden_compra: string;
  fecha_ingreso: string;
  fecha_entrega: string;
  numero_orden_programacion: number | null;
  posicion_programacion: number | null;
  cliente: { razon_social: string } | null;
  item_orden: { id: string; descripcion: string; cantidad: number }[];
  avance_seccion: {
    checkpoint: CheckpointId;
    fecha_hora: string;
    usuario: { nombre: string } | null;
  }[];
};

function aOrden(fila: FilaOrden): OrdenPorProgramar {
  const referencias = fila.item_orden.map((item) => ({
    id: item.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
  }));

  return {
    id: fila.id,
    numeroOrdenCompra: fila.numero_orden_compra,
    razonSocial: fila.cliente?.razon_social ?? "Cliente sin nombre",
    fechaIngreso: fila.fecha_ingreso,
    fechaEntrega: fila.fecha_entrega,
    referencias,
    totalPrendas: totalDePrendas(referencias),
    marcados: fila.avance_seccion.map((avance) => avance.checkpoint),
  };
}

/**
 * Las órdenes que esperan programación, la que llegó primero arriba.
 *
 * El orden sugerido es el de llegada (`fecha_ingreso`), que es el criterio por
 * defecto de la historia; el de relevancia lo decide la secretaria moviéndolas
 * en la hoja, y eso no se guarda como preferencia: queda en el turno con el que
 * se programaron.
 *
 * Quién califica lo decide el motor y no una condición escrita aquí: aparece la
 * orden a la que el motor le permitiría marcar esta etapa. Hoy eso es "toda
 * orden sin programar", porque la cotización (HU-02) todavía no está
 * disponible; el día que esa historia encienda su etapa, las órdenes sin
 * cotización aprobada dejarán de aparecer solas, sin tocar este archivo.
 */
export async function listarOrdenesPorProgramar(): Promise<
  OrdenPorProgramar[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(SELECCION)
    .is(AVANCE_VIGENTE, null)
    .is("posicion_programacion", null)
    .order("fecha_ingreso", { ascending: true });

  if (error) {
    console.error(
      "[HU-03] No se pudieron leer las órdenes por programar",
      error,
    );
    throw new Error("No se pudieron leer las órdenes.");
  }

  return data
    .map(aOrden)
    .filter(
      (orden) => puedeProgramar(orden.marcados, ROL_DE_PROGRAMACION).permitido,
    );
}

/**
 * Las hojas de programación, de la más reciente a la más vieja, y dentro de
 * cada una las órdenes en su turno.
 *
 * Se agrupa aquí y no en la base porque son dos columnas de la misma tabla: la
 * consulta trae las órdenes ya ordenadas por hoja y turno, y esto solo las
 * reparte.
 */
export async function listarHojasDeProgramacion(): Promise<
  HojaDeProgramacion[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(SELECCION)
    .is(AVANCE_VIGENTE, null)
    .not("posicion_programacion", "is", null)
    .order("numero_orden_programacion", { ascending: false })
    .order("posicion_programacion", { ascending: true });

  if (error) {
    console.error("[HU-03] No se pudieron leer las hojas", error);
    throw new Error("No se pudieron leer las hojas de programación.");
  }

  const hojas = new Map<number, HojaDeProgramacion>();

  for (const fila of data) {
    // El check `orden_programacion_completa` garantiza que si hay turno hay
    // hoja; el estrechamiento es para TypeScript, no una condición real.
    if (fila.numero_orden_programacion === null) continue;
    if (fila.posicion_programacion === null) continue;

    const orden: OrdenEnLaHoja = {
      ...aOrden(fila),
      turno: fila.posicion_programacion,
    };

    const avance = fila.avance_seccion.find(
      (candidato) => candidato.checkpoint === "programada_diseno",
    );

    const hoja = hojas.get(fila.numero_orden_programacion) ?? {
      numero: fila.numero_orden_programacion,
      ordenes: [],
      totalPrendas: 0,
      programadaEn: avance?.fecha_hora ?? null,
      programadaPor: avance?.usuario?.nombre ?? null,
    };

    hoja.ordenes.push(orden);
    hoja.totalPrendas += orden.totalPrendas;

    hojas.set(fila.numero_orden_programacion, hoja);
  }

  return [...hojas.values()];
}
