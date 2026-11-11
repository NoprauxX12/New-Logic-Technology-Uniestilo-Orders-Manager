import Link from "next/link";

/**
 * El camino al detalle de una orden (`/ordenes/<orden>`) desde cualquier lista
 * de trabajo. El detalle es el mismo para todos los roles: para quién es, la
 * entrega, las prendas con sus tallas, la ficha técnica y los talleres por los
 * que pasó. Las listas se quedan cortas y el detalle está a un toque.
 */
export function EnlaceDetalleOrden({
  ordenId,
  numeroOrdenCompra,
}: {
  ordenId: string;
  numeroOrdenCompra: string;
}) {
  return (
    <Link
      href={`/ordenes/${ordenId}`}
      aria-label={`Ver detalle de la orden ${numeroOrdenCompra}`}
      className="inline-flex min-h-11 items-center text-sm font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900"
    >
      Ver detalle de la orden
    </Link>
  );
}
