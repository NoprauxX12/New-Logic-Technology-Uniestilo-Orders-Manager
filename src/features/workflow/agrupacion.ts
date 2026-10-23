import type { OrdenParaSeccion } from "@/features/workflow/queries";
import { compararPorUrgencia } from "@/lib/ordenes/urgencia";

/**
 * Cómo se ordenan las listas de las secciones.
 *
 * Una lista tiene que contestar «¿qué hago ahora?». Por eso no se muestran todas
 * las órdenes del sistema por fecha de entrega (lo más viejo, que casi siempre
 * ya se terminó, quedaba arriba), sino en tres grupos y en este orden:
 *
 * 1. **Para marcar ahora**: las órdenes a las que les toca esta etapa. Primero las
 *    atrasadas, después las de entrega más cercana.
 * 2. **Todavía no les toca**: las que aún no llegan. Primero las que están más
 *    cerca de llegar, con el motivo de por qué esperan.
 * 3. **Ya marcadas**: lo que esta sección terminó hace poco, lo más reciente
 *    primero. Las órdenes ya cerradas no aparecen en ningún grupo.
 *
 * Es una función pura: recibe lo que el motor ya dijo de cada orden y no decide
 * ninguna regla del flujo por su cuenta.
 */

/** Cuántos días se sigue mostrando lo que la sección ya marcó. */
export const DIAS_DE_MARCADAS = 7;

export type OrdenesAgrupadas = {
  paraMarcar: OrdenParaSeccion[];
  enEspera: OrdenParaSeccion[];
  hechas: OrdenParaSeccion[];
};

const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * ¿Le toca a esta sección? Es su turno cuando el motor deja marcar, y también
 * cuando solo falta que quien mira tenga el rol (administración ve la pantalla
 * de corte, pero no marca): la orden está en esa etapa de todos modos.
 */
function esSuTurno(orden: OrdenParaSeccion): boolean {
  return (
    orden.veredicto.permitido || orden.veredicto.motivo === "rol_no_autorizado"
  );
}

export type OpcionesDeAgrupacion = {
  /**
   * Cuántos días se sigue mostrando lo ya marcado; `null` es sin límite. Diseño
   * lo usa sin límite porque puede adjuntar otra versión de una ficha vieja.
   */
  diasDeMarcadas?: number | null;
};

export function agruparOrdenesDeSeccion(
  ordenes: readonly OrdenParaSeccion[],
  ahora = new Date(),
  { diasDeMarcadas = DIAS_DE_MARCADAS }: OpcionesDeAgrupacion = {},
): OrdenesAgrupadas {
  const paraMarcar: OrdenParaSeccion[] = [];
  const enEspera: OrdenParaSeccion[] = [];
  const hechas: OrdenParaSeccion[] = [];
  const limite =
    diasDeMarcadas === null
      ? Number.NEGATIVE_INFINITY
      : ahora.getTime() - diasDeMarcadas * MS_DIA;

  for (const orden of ordenes) {
    if (orden.cerrada) continue;

    if (orden.yaMarcada) {
      const cuando = orden.fechaMarcado ? Date.parse(orden.fechaMarcado) : NaN;
      // Sin límite se muestra aunque no tenga fecha; con límite hace falta saber
      // si es reciente.
      if (diasDeMarcadas === null || cuando >= limite) hechas.push(orden);
      continue;
    }

    // Pasó de largo esta etapa: ni se puede marcar ni queda nada por esperar.
    if (orden.noAplica) continue;

    if (esSuTurno(orden)) paraMarcar.push(orden);
    else enEspera.push(orden);
  }

  paraMarcar.sort(compararPorUrgencia(ahora));
  enEspera.sort(
    (uno, otro) =>
      uno.etapasFaltantes - otro.etapasFaltantes ||
      compararPorUrgencia(ahora)(uno, otro),
  );
  hechas.sort((uno, otro) =>
    (otro.fechaMarcado ?? "").localeCompare(uno.fechaMarcado ?? ""),
  );

  return { paraMarcar, enEspera, hechas };
}

/** Las más antiguas primero: «la que lleva más tiempo esperando». */
export function ordenarPorLlegada(
  ordenes: readonly OrdenParaSeccion[],
): OrdenParaSeccion[] {
  return [...ordenes].sort(
    (uno, otro) =>
      uno.fechaIngreso.localeCompare(otro.fechaIngreso) ||
      uno.numeroOrdenCompra.localeCompare(otro.numeroOrdenCompra),
  );
}

/** Las que llevan más tiempo en el mismo estado primero (según `fechaMarcado`). */
export function ordenarPorAntiguedad(
  ordenes: readonly OrdenParaSeccion[],
): OrdenParaSeccion[] {
  return [...ordenes].sort(
    (uno, otro) =>
      (uno.fechaMarcado ?? "9999").localeCompare(otro.fechaMarcado ?? "9999") ||
      uno.numeroOrdenCompra.localeCompare(otro.numeroOrdenCompra),
  );
}
