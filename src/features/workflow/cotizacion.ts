import type { OrdenParaSeccion } from "@/features/workflow/queries";

/**
 * HU-02 · Qué le toca hacer a cada orden en la pantalla de cotización.
 *
 * La pantalla marca dos etapas seguidas —enviada y aprobada— pero una orden
 * muestra solo la que le toca: primero se envía; cuando ya se envió, queda
 * esperando la aprobación del cliente. Las que ya pasaron las dos, o que
 * avanzaron sin ellas, no aparecen.
 *
 * Es una función pura: recibe lo que el motor dijo de cada etapa y no decide
 * nada por su cuenta. Se queda con las órdenes donde el motor dejaría marcar
 * (o las dejaría si quien mira tuviera el rol, que es el caso de
 * administración, que ve la pantalla pero no marca).
 */

export type OrdenesDeCotizacion = {
  /** Registradas, con la cotización sin enviar. */
  porEnviar: OrdenParaSeccion[];
  /** Enviadas, esperando que el cliente la apruebe. */
  porAprobar: OrdenParaSeccion[];
};

function lesToca(orden: OrdenParaSeccion): boolean {
  if (orden.yaMarcada) return false;
  return (
    orden.veredicto.permitido || orden.veredicto.motivo === "rol_no_autorizado"
  );
}

/**
 * @param enviadas Las órdenes vistas desde la etapa `cotizacion_enviada`.
 * @param aprobadas Las mismas órdenes vistas desde `cotizacion_aprobada`.
 */
export function repartirPorCotizacion(
  enviadas: readonly OrdenParaSeccion[],
  aprobadas: readonly OrdenParaSeccion[],
): OrdenesDeCotizacion {
  const aprobadasPorId = new Map(aprobadas.map((orden) => [orden.id, orden]));

  const porEnviar = enviadas.filter(lesToca);

  const porAprobar = enviadas
    .filter((orden) => orden.yaMarcada)
    .flatMap((orden) => {
      const aprobada = aprobadasPorId.get(orden.id);
      return aprobada && lesToca(aprobada) ? [aprobada] : [];
    });

  return { porEnviar, porAprobar };
}
