import { TableroOrdenes } from "@/features/tablero/components/TableroOrdenes";
import {
  listarOrdenesTablero,
  obtenerResumenTablero,
} from "@/features/tablero/queries";

export default async function TableroPage() {
  const ordenes = await listarOrdenesTablero();
  const resumen = await obtenerResumenTablero(ordenes);

  return <TableroOrdenes ordenes={ordenes} resumen={resumen} />;
}
