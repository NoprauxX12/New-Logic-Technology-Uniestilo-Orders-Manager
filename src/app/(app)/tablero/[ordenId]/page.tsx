import { notFound } from "next/navigation";

import { DetalleOrdenView } from "@/features/tablero/components/DetalleOrdenView";
import { obtenerDetalleOrden } from "@/features/tablero/queries";

type Props = {
  params: Promise<{ ordenId: string }>;
};

export default async function DetalleOrdenPage({ params }: Props) {
  const { ordenId } = await params;
  const orden = await obtenerDetalleOrden(ordenId);

  if (!orden) notFound();

  return <DetalleOrdenView orden={orden} />;
}
