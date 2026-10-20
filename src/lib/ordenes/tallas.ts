/**
 * Los tallajes que maneja Uniestilo y las tallas de cada uno.
 *
 * Es la única fuente: el formulario de registro dibuja la cuadrícula de aquí,
 * el esquema valida contra aquí, y lo que se guarda en `item_orden.tallas` se
 * arma aquí. Vive en `lib/` porque lo van a usar el registro, el despacho a
 * taller y las órdenes de corrección (HU-18).
 *
 * El orden de cada arreglo es el orden en que se muestran y en que se escriben
 * en el texto guardado: de la más pequeña a la más grande.
 *
 * Los identificadores (`superior_hombre`…) también están en el `check` de
 * `item_orden.tallaje`; si se agrega un tallaje, cambia este archivo y una
 * migración (lo verifica `tallas.test.ts`).
 */

export const TALLAJES = {
  superior_hombre: {
    etiqueta: "Superior hombre",
    tallas: [
      "XXS",
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "2XL",
      "3XL",
      "4XL",
      "5XL",
      "6XL",
    ],
  },
  inferior_hombre: {
    etiqueta: "Inferior hombre",
    tallas: [
      "28",
      "30",
      "32",
      "34",
      "36",
      "38",
      "40",
      "42",
      "44",
      "46",
      "48",
      "50",
    ],
  },
  // Superior e inferior de dama tienen las mismas tallas (2 a 24). Se guardan
  // como tallajes distintos porque son prendas distintas, y después hay que
  // poder saber cuál se usó.
  superior_dama: {
    etiqueta: "Superior dama",
    tallas: [
      "2",
      "4",
      "6",
      "8",
      "10",
      "12",
      "14",
      "16",
      "18",
      "20",
      "22",
      "24",
    ],
  },
  inferior_dama: {
    etiqueta: "Inferior dama",
    tallas: [
      "2",
      "4",
      "6",
      "8",
      "10",
      "12",
      "14",
      "16",
      "18",
      "20",
      "22",
      "24",
    ],
  },
} as const satisfies Record<
  string,
  { etiqueta: string; tallas: readonly string[] }
>;

export type TallajeId = keyof typeof TALLAJES;

/**
 * Para lo que no cabe en un tallaje (gorras, delantales, ropa de niños, tallas
 * únicas): las tallas se escriben a mano y la cantidad también, como antes.
 */
export const TALLAJE_OTRO = "otro";

export const IDS_DE_TALLAJE = Object.keys(TALLAJES) as TallajeId[];

/** Los valores que acepta `item_orden.tallaje`. */
export const TALLAJES_VALIDOS: readonly string[] = [
  ...IDS_DE_TALLAJE,
  TALLAJE_OTRO,
];

export function esTallaje(valor: string): valor is TallajeId {
  return Object.hasOwn(TALLAJES, valor);
}

/** Cuántas prendas suma una cantidad por talla. */
export function sumarTallas(
  cantidades: Readonly<Record<string, number>>,
): number {
  return Object.values(cantidades).reduce((total, cantidad) => {
    return total + cantidad;
  }, 0);
}

/**
 * El texto que se guarda en `item_orden.tallas`: `XS:10, S:20, M:40`.
 *
 * Va en el orden del tallaje y solo con las tallas que tienen prendas, así dos
 * órdenes iguales se guardan igual sin importar en qué orden se llenó la
 * cuadrícula. Es el mismo formato que se escribía a mano, por eso nada de lo
 * que hoy lee ese texto cambia.
 */
export function armarTextoTallas(
  tallaje: TallajeId,
  cantidades: Readonly<Record<string, number>>,
): string {
  return TALLAJES[tallaje].tallas
    .filter((talla) => (cantidades[talla] ?? 0) > 0)
    .map((talla) => `${talla}:${cantidades[talla]}`)
    .join(", ");
}
