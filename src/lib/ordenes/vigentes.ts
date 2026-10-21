/**
 * Avances vigentes de una orden (HU-18).
 *
 * Una devolución a una etapa anterior no borra los avances: les pone
 * `anulado_por`. Para el estado de la orden, un avance anulado es como si no
 * existiera, así que TODA lectura de `avance_seccion` que decida algo tiene que
 * ignorarlos. El filtro vive aquí para escribirlo una sola vez:
 *
 *   supabase.from("orden").select("id, avance_seccion ( checkpoint )")
 *     .is(AVANCE_VIGENTE, null)
 *
 * Es un filtro sobre la tabla anidada: las órdenes se traen todas y a cada una
 * solo le llegan sus avances vigentes. `vigentes.test.ts` revisa que ninguna
 * consulta de `src/` lea avances sin él (o sin leer `anulado_por` para
 * separarlos a mano, como hace el detalle de la orden).
 */
export const AVANCE_VIGENTE = "avance_seccion.anulado_por";
