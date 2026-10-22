/**
 * Datos de prueba que se generan en cada ejecución.
 *
 * El número de orden de compra es único en toda la base, así que cada corrida
 * usa uno distinto (con la hora) y las pruebas se pueden repetir sin reiniciar
 * Supabase.
 */

export type DatosPrenda =
  | {
      descripcion: string;
      valor: string;
      /** Un tallaje del catálogo, con cuántas prendas de cada talla. */
      tallaje:
        | "superior_hombre"
        | "inferior_hombre"
        | "superior_dama"
        | "inferior_dama";
      cantidadesPorTalla: Record<string, string>;
    }
  | {
      descripcion: string;
      valor: string;
      /** «Otro»: la cantidad y las tallas se escriben a mano. */
      tallaje: "otro";
      cantidad: string;
      tallas: string;
    };

export type DatosOrden = {
  numeroOrdenCompra: string;
  fechaIngreso: string;
  fechaEntrega: string;
  nit: string;
  razonSocial: string;
  contactoNombre: string;
  contactoCelular: string;
  prendas: DatosPrenda[];
};

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Un número de orden que no se repite entre corridas: `OC-E2E-` más la hora en
 * milisegundos escrita en base 36 (por ejemplo `OC-E2E-MH3K9X2A`).
 */
export function numeroOrdenUnico(ahora = new Date()): string {
  return `OC-E2E-${ahora.getTime().toString(36).toUpperCase()}`;
}

/** Una orden válida con dos prendas: una por tallaje y otra escrita a mano. */
export function ordenValida(ahora = new Date()): DatosOrden {
  const entrega = new Date(ahora);
  entrega.setDate(entrega.getDate() + 30);

  return {
    numeroOrdenCompra: numeroOrdenUnico(ahora),
    fechaIngreso: aIso(ahora),
    fechaEntrega: aIso(entrega),
    nit: "900.555.123-4",
    razonSocial: "Confecciones del Valle S.A.S.",
    contactoNombre: "Camila Restrepo",
    contactoCelular: "300 555 1234",
    prendas: [
      {
        descripcion: "Camisas ejecutivas azules manga larga",
        valor: "18500000",
        tallaje: "superior_hombre",
        cantidadesPorTalla: { S: "20", M: "40", L: "30" },
      },
      {
        descripcion: "Gorras con logo bordado",
        valor: "2400000",
        tallaje: "otro",
        cantidad: "50",
        tallas: "Única:50",
      },
    ],
  };
}

/** Cuántas prendas suma una orden: lo que debe decir el total de cada fila. */
export function totalDePrenda(prenda: DatosPrenda): number {
  if (prenda.tallaje === "otro") return Number(prenda.cantidad);
  return Object.values(prenda.cantidadesPorTalla).reduce(
    (total, cantidad) => total + Number(cantidad || 0),
    0,
  );
}
