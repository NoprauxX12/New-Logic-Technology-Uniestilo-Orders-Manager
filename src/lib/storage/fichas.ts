/**
 * Rutas y metadatos de las fichas técnicas en Storage (HU-04).
 *
 * El archivo vive en el bucket `fichas` bajo `<orden_id>/<archivo>`. En la
 * base solo se guarda esa ruta: una URL firmada expira y dejaría filas que
 * apuntan a nada. Vive en `lib/` porque lo usan fichas, tablero y workflow.
 */

export const BUCKET_FICHAS = "fichas";

/** 10 MB, el mismo tope del bucket. */
export const TAMANO_MAXIMO_FICHA = 10 * 1024 * 1024;

export const MIME_FICHA = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** Una hora: quien abre el tablero pide otra URL al recargar. */
export const SEGUNDOS_URL_FICHA = 60 * 60;

export type FichaVisible = {
  id: string;
  nombre: string;
  url: string | null;
  subidaPor: string;
  fechaSubida: string;
};

/** Lo que llega del `select` anidado de `ficha_tecnica`. */
export type FilaFicha = {
  id: string;
  archivo_ruta: string;
  fecha_subida: string;
  usuario: { nombre: string } | null;
};

/**
 * El objeto dentro del bucket. El seed viejo guardaba `fichas/...`; las
 * subidas nuevas ya no llevan el prefijo del bucket.
 */
export function objetoDeRuta(ruta: string): string {
  return ruta.replace(/^fichas\//, "");
}

/** El nombre del archivo, para mostrarlo sin la carpeta de la orden. */
export function nombreDeRuta(ruta: string): string {
  const objeto = objetoDeRuta(ruta);
  const segmento = objeto.split("/").pop();
  return segmento && segmento.length > 0 ? segmento : "ficha-tecnica";
}

/** Nombre seguro para guardar: sin tildes, espacios ni caracteres raros. */
export function nombreSeguro(nombre: string): string {
  const base = nombre.normalize("NFD").replace(/\p{M}/gu, "");
  const limpio = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const recortado = limpio.slice(0, 80);
  return recortado.length > 0 ? recortado : "ficha";
}

/** Ruta que se guarda en `ficha_tecnica.archivo_ruta`. */
export function rutaDeArchivo(
  ordenId: string,
  nombreOriginal: string,
  ahora = Date.now(),
): string {
  return `${ordenId}/${ahora}-${nombreSeguro(nombreOriginal)}`;
}
