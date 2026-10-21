import { ListaAlertasTablero } from "@/features/alertas/components/ListaAlertasTablero";
import { listarAlertasDeTelaPendientes } from "@/features/alertas/queries";
import { exigirAcceso } from "@/features/auth/guardia";
import { TableroEnVivo } from "@/features/tablero/components/TableroEnVivo";
import { TableroOrdenes } from "@/features/tablero/components/TableroOrdenes";
import {
  contarFiltros,
  filtrarTablero,
  leerFiltros,
} from "@/lib/ordenes/filtros";
import {
  listarOrdenesTablero,
  obtenerResumenTablero,
} from "@/lib/ordenes/estadoOrden";

/** HU-14 · El tablero es de administración (HU-17). */
export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAcceso("/tablero");

  const [ordenes, alertas] = await Promise.all([
    listarOrdenesTablero(),
    listarAlertasDeTelaPendientes(),
  ]);
  // Las métricas de arriba cuentan todo; el filtro solo cambia la lista.
  const resumen = await obtenerResumenTablero(ordenes);
  const filtros = leerFiltros(await searchParams);
  const ahora = new Date();

  return (
    <TableroEnVivo>
      <TableroOrdenes
        ordenes={filtrarTablero(ordenes, filtros, ahora)}
        totalOrdenes={ordenes.length}
        filtros={filtros}
        conteos={contarFiltros(ordenes, filtros.q, ahora)}
        resumen={resumen}
        avisos={<ListaAlertasTablero alertas={alertas} />}
      />
    </TableroEnVivo>
  );
}
