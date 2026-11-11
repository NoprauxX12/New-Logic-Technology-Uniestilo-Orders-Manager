import type { PrendaDeLaOrden } from "@/features/insumos/queries";

/**
 * HU-23 · Las prendas de la orden de compra: de aquí sale el listado de
 * insumos (cuántas prendas, de qué, con qué observaciones).
 */
export function PrendasDeLaOrden({ prendas }: { prendas: PrendaDeLaOrden[] }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-zinc-700">
        Prendas de la orden de compra
      </p>
      {prendas.length === 0 ? (
        <p className="text-sm text-zinc-600">La orden no tiene prendas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {prendas.map((prenda) => (
            <li
              key={prenda.id}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <p className="font-medium text-zinc-900">
                {prenda.cantidad} · {prenda.descripcion}
              </p>
              <p className="text-zinc-600">Tallas: {prenda.tallas}</p>
              {prenda.observaciones ? (
                <p className="text-zinc-600">{prenda.observaciones}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
