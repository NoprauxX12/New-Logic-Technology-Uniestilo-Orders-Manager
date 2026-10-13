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
