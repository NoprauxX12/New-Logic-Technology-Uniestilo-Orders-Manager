import { notFound } from "next/navigation";

import { usuarioActual } from "@/features/auth/usuarioActual";
import { DetalleOrdenView } from "@/features/tablero/components/DetalleOrdenView";
import { TableroEnVivo } from "@/features/tablero/components/TableroEnVivo";
import { obtenerDetalleOrden } from "@/features/tablero/queries";
import { AccionMarcarAvance } from "@/features/workflow/components/AccionMarcarAvance";
import { puedeMarcar } from "@/features/workflow/transiciones";

type Props = {
  params: Promise<{ ordenId: string }>;
};

export default async function DetalleOrdenPage({ params }: Props) {
  const { ordenId } = await params;
  const orden = await obtenerDetalleOrden(ordenId);

  if (!orden) notFound();

  const usuario = await usuarioActual();
  const marcados = orden.avances.map((avance) => avance.seccion);

  // Solo la salida a despacho (HU-19). La acción y el motor son genéricos, así
  // que las demás secciones se enchufan aquí pasando su propio checkpoint:
  // HU-08 `corte_completado`, HU-12 `llegada_marcacion`, HU-13 `cerrada`.
  //
  // Se monta siempre, aunque el motor no deje marcar: es el componente el que
  // decide qué pintar. Si fuera esta página la que decidiera, al marcar con
  // éxito dejaría de renderizarlo, React lo desmontaría y se perdería la
  // confirmación justo en ese momento — y aquí llegan dos re-renders, el de
  // `revalidatePath` y el de Realtime.
  const accion = (
    <AccionMarcarAvance
      ordenId={orden.id}
      checkpoint="lista_despacho"
      veredicto={puedeMarcar({
        checkpoint: "lista_despacho",
        marcados,
        rol: usuario.rol,
      })}
    />
  );

  return (
    <TableroEnVivo>
      <DetalleOrdenView orden={orden} accion={accion} />
    </TableroEnVivo>
  );
}
