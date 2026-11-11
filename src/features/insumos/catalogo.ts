import type { Database } from "@/types/database.types";

/**
 * HU-23 · Los insumos que secretaría valida en una orden, además de la tela.
 *
 * Son los siete que nombra la historia, en el orden en que se leen en el
 * taller. La base repite la lista en el enum `tipo_insumo`; `catalogo.test.ts`
 * verifica que las dos digan lo mismo. Si la PO pide otro insumo, cambia este
 * archivo y una migración que agregue el valor al enum.
 */

export type TipoInsumo = Database["public"]["Enums"]["tipo_insumo"];

export type Insumo = {
  id: TipoInsumo;
  /** Como se lee en pantalla y en el listado impreso. */
  etiqueta: string;
  /** Una pista de qué escribir en el detalle. */
  ejemplo: string;
};

export const INSUMOS = [
  { id: "hilo", etiqueta: "Hilo", ejemplo: "20 conos de hilo azul 40/2" },
  {
    id: "resorte",
    etiqueta: "Resorte",
    ejemplo: "90 metros de resorte de 3 cm",
  },
  {
    id: "cierre",
    etiqueta: "Cierre",
    ejemplo: "120 cierres metálicos de 60 cm",
  },
  {
    id: "boton",
    etiqueta: "Botón",
    ejemplo: "1.500 botones blancos de 4 huecos",
  },
  {
    id: "hilo_bordar",
    etiqueta: "Hilo de bordar",
    ejemplo: "6 conos de hilo de bordar blanco",
  },
  {
    id: "sublimado",
    etiqueta: "Sublimado",
    ejemplo: "Logo en la espalda, 80 unidades",
  },
  {
    id: "estampado",
    etiqueta: "Estampado",
    ejemplo: "Escudo en el bolsillo, 450 unidades",
  },
] as const satisfies readonly Insumo[];

const POR_ID = new Map<TipoInsumo, Insumo>(
  INSUMOS.map((insumo) => [insumo.id, insumo]),
);

/** La etiqueta de un insumo, para pintarlo. */
export function etiquetaDeInsumo(id: TipoInsumo): string {
  return POR_ID.get(id)?.etiqueta ?? id;
}

/** ¿Es este texto uno de los insumos del catálogo? */
export function esTipoInsumo(valor: string): valor is TipoInsumo {
  return INSUMOS.some((insumo) => insumo.id === valor);
}

/** Cuántos caracteres admite el detalle de un insumo (igual que la base). */
export const MAXIMO_DETALLE = 300;
