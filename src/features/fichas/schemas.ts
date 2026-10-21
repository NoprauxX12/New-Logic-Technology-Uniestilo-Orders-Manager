import { z } from "zod";

import { MIME_FICHA, TAMANO_MAXIMO_FICHA } from "@/lib/storage/fichas";

/**
 * HU-04 · Validación de la ficha técnica que se adjunta a una orden.
 *
 * Quién sube no va en el formulario: sale de la sesión (HU-16). Un campo
 * oculto lo podría cambiar cualquiera, y la bitácora tiene que ser confiable
 * (RNF-05).
 *
 * `guid` y no `uuid`: los identificadores del seed no cumplen la RFC 4122.
 */

const ordenId = z.guid({ error: "No se sabe de qué orden es esta ficha" });

function esTipoFicha(archivo: File): boolean {
  if ((MIME_FICHA as readonly string[]).includes(archivo.type)) {
    return true;
  }

  return /\.(pdf|jpe?g|png|xlsx?)$/i.test(archivo.name);
}

export const adjuntarFichaSchema = z.object({
  ordenId,
  archivo: z
    .instanceof(File, { error: "Elige el archivo de la ficha técnica" })
    .refine(
      (archivo) => archivo.size > 0,
      "Elige el archivo de la ficha técnica",
    )
    .refine(
      (archivo) => archivo.size <= TAMANO_MAXIMO_FICHA,
      "La ficha no puede pesar más de 10 MB",
    )
    .refine(
      esTipoFicha,
      "La ficha tiene que ser un PDF, un JPG, un PNG o un Excel",
    ),
});

export type AdjuntarFicha = z.infer<typeof adjuntarFichaSchema>;
