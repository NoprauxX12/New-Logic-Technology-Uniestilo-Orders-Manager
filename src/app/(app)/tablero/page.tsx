import { ListaAlertasTablero } from "@/features/alertas/components/ListaAlertasTablero";
import { listarAlertasDeTelaPendientes } from "@/features/alertas/queries";
import { exigirAcceso } from "@/features/auth/guardia";
import { TableroEnVivo } from "@/features/tablero/components/TableroEnVivo";
import { TableroOrdenes } from "@/features/tablero/components/TableroOrdenes";
import {
  listarOrdenesTablero,
  obtenerResumenTablero,
} from "@/lib/ordenes/estadoOrden";

/** HU-14 · El tablero es de administración (HU-17). */
export default async function TableroPage() {
  await exigirAcceso("/tablero");

  const [ordenes, alertas] = await Promise.all([
    listarOrdenesTablero(),
    listarAlertasDeTelaPendientes(),
  ]);
  const resumen = await obtenerResumenTablero(ordenes);

  return (
    <TableroEnVivo>
      <TableroOrdenes
        ordenes={ordenes}
        resumen={resumen}
        avisos={<ListaAlertasTablero alertas={alertas} />}
      />
    </TableroEnVivo>
  );
}
