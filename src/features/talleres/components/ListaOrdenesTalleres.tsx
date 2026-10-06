import Link from "next/link";

import type { OrdenParaTalleres } from "@/features/talleres/queries";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-10 y HU-11 · Las órdenes con las que logística trabaja. Cada una lleva al
 * detalle, donde se despacha un lote o se confirma su recepción.
 */

type Props = {
  ordenes: OrdenParaTalleres[];
};

export function ListaOrdenesTalleres({ ordenes }: Props) {
  if (ordenes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
        <p className="font-medium text-zinc-900">
          No hay órdenes con el corte hecho
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Cuando corte termine una orden, aparecerá aquí para despacharla.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {ordenes.map((orden) => (
        <li
          key={orden.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                Orden de compra
              </p>
              <h2 className="text-lg font-semibold text-zinc-900">
                {orden.numeroOrdenCompra}
              </h2>
              <p className="mt-1 text-sm text-zinc-700">{orden.razonSocial}</p>
              <p className="mt-1 text-sm text-zinc-500">
                Entrega: {formatearFecha(orden.fechaEntrega)}
              </p>
              <p className="mt-2 text-sm font-medium text-stone-700">
                {orden.estadoTalleres}
              </p>
            </div>

            <Link
              href={`/ordenes/${orden.id}`}
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800"
            >
              Abrir {orden.numeroOrdenCompra}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
