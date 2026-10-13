import { exigirAcceso } from "@/features/auth/guardia";
import { TableroEnVivo } from "@/features/tablero/components/TableroEnVivo";
import { TableroOrdenes } from "@/features/tablero/components/TableroOrdenes";
import {
  listarOrdenesTablero,
  obtenerResumenTablero,
} from "@/features/tablero/queries";

/** HU-14 · El tablero es de administración (HU-17). */
export default async function TableroPage() {
  await exigirAcceso("/tablero");

  const ordenes = await listarOrdenesTablero();
  const resumen = await obtenerResumenTablero(ordenes);

  return (
    <TableroEnVivo>
      <TableroOrdenes ordenes={ordenes} resumen={resumen} />
    </TableroEnVivo>
  );
}
