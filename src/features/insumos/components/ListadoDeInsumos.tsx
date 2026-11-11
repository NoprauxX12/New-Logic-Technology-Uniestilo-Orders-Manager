import { etiquetaDeInsumo } from "@/features/insumos/catalogo";
import type { InsumoDelListado } from "@/features/insumos/reglas";

/** HU-23 · El listado validado, de solo lectura: cada insumo con su detalle. */
export function ListadoDeInsumos({ listado }: { listado: InsumoDelListado[] }) {
  if (listado.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        Todavía no se han validado los insumos de esta orden.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200">
      {listado.map((item) => (
        <li key={item.insumo} className="px-3 py-2 text-sm">
          <span className="font-semibold text-zinc-900">
            {etiquetaDeInsumo(item.insumo)}:
          </span>{" "}
          <span className="text-zinc-700">{item.detalle}</span>
        </li>
      ))}
    </ul>
  );
}
