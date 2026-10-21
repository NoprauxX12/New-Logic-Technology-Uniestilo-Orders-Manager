/**
 * Una fecha de la base (`2026-09-09`) como se lee en el taller (`09/09/2026`).
 *
 * Se parte el texto en vez de usar `new Date()`: una fecha sin hora se
 * interpreta en UTC, y en Colombia eso corre el día hacia atrás.
 */
export function formatearFecha(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * Un instante de la bitácora (`2026-09-16T00:00:10.999+00:00`) como el día en
 * que pasó, visto desde el taller (`15/09/2026`).
 *
 * Las columnas de momento —`avance_seccion.fecha_hora`, `lote_taller.fecha_envio`—
 * guardan la hora en UTC, así que aquí sí hay que convertir a la hora de
 * Colombia: un avance de las siete de la noche se registra al día siguiente en
 * UTC, y mostrarlo así le cambiaría el día a quien lo marcó.
 *
 * `formatearFecha` no sirve para esto: parte el texto por guiones y un instante
 * le deja la hora pegada al día.
 */
export function formatearDia(momentoIso: string): string {
  return new Date(momentoIso).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * El día de hoy en Colombia (`2026-10-21`), no el del servidor, que en Vercel
 * está en UTC: a las nueve de la noche en Marinilla ya es "mañana" allá.
 */
export function hoyEnBogota(ahora = new Date()): string {
  return ahora.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}
