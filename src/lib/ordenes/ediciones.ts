import { z } from "zod";

import { esTallaje, TALLAJE_OTRO, TALLAJES } from "@/lib/ordenes/tallas";

/**
 * Lo que guarda `edicion_orden.cambios`, contado en frases para el detalle de la
 * orden (`docs/adr/0012`). Vive en `lib/` porque lo escribe la base y lo lee el
 * tablero, que no depende de la feature de órdenes.
 */

const valor = z.union([z.string(), z.number(), z.null()]);
const cambio = z.object({ antes: valor, despues: valor });
const campos = z.record(z.string(), cambio);

const prendaGuardada = z.object({ descripcion: z.string() });

const esquemaCambios = z.object({
  orden: campos.optional(),
  cliente: campos.optional(),
  prendas: z
    .object({
      agregadas: z.array(prendaGuardada),
      quitadas: z.array(prendaGuardada),
      cambiadas: z.array(z.object({ descripcion: z.string(), campos: campos })),
    })
    .optional(),
});

const ETIQUETAS: Record<string, string> = {
  numero_orden_compra: "Número de orden de compra",
  fecha_ingreso: "Fecha de ingreso",
  fecha_entrega: "Fecha de entrega",
  observaciones: "Observaciones",
  nit: "NIT",
  razon_social: "Razón social",
  contacto_nombre: "Persona de contacto",
  contacto_celular: "Celular",
  descripcion: "Prenda",
  cantidad: "Cantidad",
  tallas: "Tallas",
  tallaje: "Tallaje",
  valor: "Valor",
};

/** Cómo se lee el valor: el tallaje se guarda con un identificador interno. */
function leerValor(campo: string, dato: z.infer<typeof valor>): string {
  if (dato === null) return "(vacío)";
  if (campo === "tallaje" && typeof dato === "string") {
    if (dato === TALLAJE_OTRO) return "Otro";
    return esTallaje(dato) ? TALLAJES[dato].etiqueta : dato;
  }
  return String(dato);
}

function frases(
  cambiados: z.infer<typeof campos>,
  prefijo: string = "",
): string[] {
  return Object.entries(cambiados).map(([campo, { antes, despues }]) => {
    const etiqueta = ETIQUETAS[campo] ?? campo;
    return `${prefijo}${etiqueta}: ${leerValor(campo, antes)} → ${leerValor(campo, despues)}`;
  });
}

/** Una frase por cada cambio. Lo que no se entiende se cuenta sin detalle. */
export function describirCambios(cambios: unknown): string[] {
  const leido = esquemaCambios.safeParse(cambios);
  if (!leido.success) return ["Se cambiaron datos de la orden."];

  const { orden, cliente, prendas } = leido.data;

  return [
    ...frases(orden ?? {}),
    ...frases(cliente ?? {}, "Cliente · "),
    ...(prendas?.agregadas ?? []).map(
      (prenda) => `Se agregó la prenda: ${prenda.descripcion}`,
    ),
    ...(prendas?.quitadas ?? []).map(
      (prenda) => `Se quitó la prenda: ${prenda.descripcion}`,
    ),
    ...(prendas?.cambiadas ?? []).flatMap((prenda) =>
      frases(prenda.campos, `${prenda.descripcion} · `),
    ),
  ];
}
