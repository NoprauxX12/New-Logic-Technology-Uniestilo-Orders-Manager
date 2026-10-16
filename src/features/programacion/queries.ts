import "server-only";

import {
  puedeProgramar,
  ROL_DE_PROGRAMACION,
  totalDePrendas,
} from "@/features/programacion/reglas";
import type { CheckpointId } from "@/features/workflow/checkpoints";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-03 · Lecturas de la programación a diseño.
 *
 * Dos consultas: las órdenes que todavía no se han programado —lo que la
 * secretaria va agregando— y la hoja ya programada, que es lo que diseño
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
  numeroOrdenProgramacion: string;
  posicionProgramacion: number;
};

const SELECCION = `id,
   numero_orden_compra,
   fecha_ingreso,
   fecha_entrega,
   numero_orden_programacion,
   posicion_programacion,
   cliente ( razon_social ),
   item_orden ( id, descripcion, cantidad ),
   avance_seccion ( checkpoint )`;

type FilaOrden = {
  id: string;
  numero_orden_compra: string;
  fecha_ingreso: string;
  fecha_entrega: string;
  numero_orden_programacion: string | null;
  posicion_programacion: number | null;
  cliente: { razon_social: string } | null;
  item_orden: { id: string; descripcion: string; cantidad: number }[];
  avance_seccion: { checkpoint: CheckpointId }[];
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
 * defecto de la historia; el de relevancia lo decide la secretaria agregándolas
 * en el orden que quiera, y eso no se guarda como preferencia: queda en la
 * posición con la que se programaron.
 *
 * Quién califica lo decide el motor y no una condición escrita aquí: aparece la
 * orden a la que el motor le permitiría marcar esta etapa. Hoy eso es "toda
 * orden sin programar", porque la cotización (HU-02) todavía no está
 * disponible; el día que esa historia encienda su etapa, las órdenes sin
 * cotización aprobada dejarán de aparecer solas, sin tocar este archivo.
 *
 * Se filtra en memoria y no con un `not.in` porque las órdenes son decenas, no
 * miles, y la condición "no tiene este avance" sobre una tabla embebida no se
 * expresa en PostgREST sin una vista.
 */
export async function listarOrdenesPorProgramar(): Promise<
  OrdenPorProgramar[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(SELECCION)
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

/** La hoja de programación, en el orden en que diseño debe trabajarla. */
export async function listarHojaDeProgramacion(): Promise<OrdenEnLaHoja[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select(SELECCION)
    .not("posicion_programacion", "is", null)
    .order("posicion_programacion", { ascending: true });

  if (error) {
    console.error("[HU-03] No se pudo leer la hoja de programación", error);
    throw new Error("No se pudo leer la hoja de programación.");
  }

  return data.flatMap((fila) => {
    // El check `orden_programacion_completa` garantiza que si hay posición hay
    // número; el estrechamiento es para TypeScript, no una condición real.
    if (fila.numero_orden_programacion === null) return [];
    if (fila.posicion_programacion === null) return [];

    return [
      {
        ...aOrden(fila),
        numeroOrdenProgramacion: fila.numero_orden_programacion,
        posicionProgramacion: fila.posicion_programacion,
      },
    ];
  });
}

/**
 * Los números de programación que ya existen entre los que se quieren usar.
 *
 * El índice único de la base es la verdad, pero rechazaría la programación
 * entera con un código de error. Esto se consulta antes para poder decir qué
 * número hay que cambiar.
 */
export async function numerosYaUsados(
  numeros: readonly string[],
): Promise<string[]> {
  if (numeros.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orden")
    .select("numero_orden_programacion")
    .not("numero_orden_programacion", "is", null);

  if (error) {
    console.error("[HU-03] No se pudieron leer los números en uso", error);
    // No es motivo para frenar: si esta consulta falla, el índice único de la
    // base sigue protegiendo la unicidad.
    return [];
  }

  const enUso = new Set(
    data.map((fila) => (fila.numero_orden_programacion ?? "").toUpperCase()),
  );

  return numeros.filter((numero) => enUso.has(numero.toUpperCase()));
}
