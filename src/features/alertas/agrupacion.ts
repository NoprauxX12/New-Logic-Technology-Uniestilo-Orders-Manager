import type { OrdenParaTelas } from "@/features/alertas/queries";
import { compararPorUrgencia } from "@/lib/ordenes/urgencia";

/**
 * Cómo se ordena la validación de telas de secretaría (HU-06, HU-22).
 *
 * 1. **Por validar**: secretaría todavía tiene que revisar si hay tela para la
 *    orden. Es su trabajo de ahora, así que va primero, por urgencia.
 * 2. **Esperando que llegue la tela**: ya se avisó a administración y falta que
 *    llegue. Primero la que lleva más días esperando: es la que hay que cobrar.
 * 3. **Tela llegada**: la tela del último aviso ya está en la empresa. Plegado:
 *    no hay nada por hacer.
 *
 * Función pura: recibe lo que la consulta ya derivó de las alertas.
 */

export type OrdenesDeTelas = {
  porValidar: OrdenParaTelas[];
  esperandoTela: OrdenParaTelas[];
  telaLlegada: OrdenParaTelas[];
};

export function agruparOrdenesDeTelas(
  ordenes: readonly OrdenParaTelas[],
  ahora = new Date(),
): OrdenesDeTelas {
  const porValidar: OrdenParaTelas[] = [];
  const esperandoTela: OrdenParaTelas[] = [];
  const telaLlegada: OrdenParaTelas[] = [];

  for (const orden of ordenes) {
    if (orden.avisoAbierto) esperandoTela.push(orden);
    else if (orden.ultimaLlegada !== null) telaLlegada.push(orden);
    else porValidar.push(orden);
  }

  const porUrgencia = compararPorUrgencia(ahora);

  porValidar.sort(porUrgencia);
  esperandoTela.sort(
    (uno, otro) =>
      (uno.avisoAbierto?.fechaCreacion ?? "").localeCompare(
        otro.avisoAbierto?.fechaCreacion ?? "",
      ) || porUrgencia(uno, otro),
  );
  telaLlegada.sort(porUrgencia);

  return { porValidar, esperandoTela, telaLlegada };
}
