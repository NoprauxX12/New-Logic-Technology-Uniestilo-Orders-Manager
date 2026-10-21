import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BUCKET_FICHAS,
  nombreDeRuta,
  objetoDeRuta,
  SEGUNDOS_URL_FICHA,
  type FichaVisible,
  type FilaFicha,
} from "@/lib/storage/fichas";
import type { Database } from "@/types/database.types";

/**
 * Firma las rutas de Storage para poder abrirlas. Si el archivo no está (el
 * seed anota la ruta pero el PDF puede faltar en local), la URL queda `null`
 * y la pantalla muestra el nombre sin enlace.
 */
export async function firmarFichas(
  supabase: SupabaseClient<Database>,
  filas: readonly FilaFicha[],
): Promise<FichaVisible[]> {
  if (filas.length === 0) return [];

  const { data } = await supabase.storage.from(BUCKET_FICHAS).createSignedUrls(
    filas.map((fila) => objetoDeRuta(fila.archivo_ruta)),
    SEGUNDOS_URL_FICHA,
  );

  return filas.map((fila, indice) => ({
    id: fila.id,
    nombre: nombreDeRuta(fila.archivo_ruta),
    url: data?.[indice]?.signedUrl ?? null,
    subidaPor: fila.usuario?.nombre ?? "Sin nombre",
    fechaSubida: fila.fecha_subida,
  }));
}
