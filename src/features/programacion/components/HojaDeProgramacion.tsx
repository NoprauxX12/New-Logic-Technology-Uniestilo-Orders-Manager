import type { HojaDeProgramacion as Hoja } from "@/features/programacion/queries";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-03 · La hoja que trabaja diseño.
 *
 * Es la misma hoja de papel que usan hoy: el número de la programación arriba,
 * las órdenes numeradas en el orden en que deben trabajarse, cada referencia
 * con su total y el total de la hoja al pie. Sin tallas y sin valor unitario —
 * ni siquiera se consultan.
 *
 * Las columnas de tela, corte y confección de la hoja de papel no están aquí a
 * propósito: eso es el estado de la orden, y el estado se deriva de los avances
 * y se ve en el tablero (regla 1). Duplicarlo aquí sería tener dos verdades.
 *
 * En celular la tabla no cabe, así que la misma información se apila.
 */

export function HojaDeProgramacion({ hoja }: { hoja: Hoja }) {
  return (
    <article className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
        <h3 className="text-lg font-semibold text-zinc-900">
          Programación #{hoja.numero}
        </h3>
        <p className="text-sm text-zinc-600">
          {hoja.ordenes.length}{" "}
          {hoja.ordenes.length === 1 ? "orden" : "órdenes"} ·{" "}
          {hoja.totalPrendas} prendas
          {hoja.programadaPor && hoja.programadaEn
            ? ` · ${hoja.programadaPor}, ${formatearFecha(hoja.programadaEn)}`
            : null}
        </p>
      </header>

      <table className="hidden w-full border-collapse text-left sm:table">
        <caption className="sr-only">
          Órdenes de la programación {hoja.numero}, en el orden en que deben
          trabajarse
        </caption>
        <thead>
          <tr className="border-b border-zinc-200">
            <th
              scope="col"
              className="w-12 px-4 py-2 text-sm font-medium text-zinc-600"
            >
              N.º
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-sm font-medium text-zinc-600"
            >
              Cliente
            </th>
            <th
              scope="col"
              className="px-4 py-2 text-sm font-medium text-zinc-600"
            >
              Prendas
            </th>
            <th
              scope="col"
              className="w-24 px-4 py-2 text-right text-sm font-medium text-zinc-600"
            >
              Cantidad
            </th>
          </tr>
        </thead>
        <tbody>
          {hoja.ordenes.map((orden) => (
            <tr key={orden.id} className="border-b border-zinc-100">
              <td className="px-4 py-3 align-top font-semibold text-zinc-900">
                {orden.turno}
              </td>
              <td className="px-4 py-3 align-top text-zinc-900">
                {orden.razonSocial}
                <span className="block text-sm text-zinc-500">
                  {orden.numeroOrdenCompra}
                </span>
              </td>
              <td className="px-4 py-3 align-top text-zinc-700">
                <ul>
                  {orden.referencias.map((referencia) => (
                    <li key={referencia.id}>{referencia.descripcion}</li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-3 text-right align-top text-zinc-700">
                <ul>
                  {orden.referencias.map((referencia) => (
                    <li key={referencia.id}>{referencia.cantidad}</li>
                  ))}
                </ul>
                {orden.referencias.length > 1 ? (
                  <p className="mt-1 border-t border-zinc-200 pt-1 font-medium text-zinc-900">
                    {orden.totalPrendas}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-zinc-50">
            <td
              colSpan={3}
              className="px-4 py-3 text-right font-medium text-zinc-700"
            >
              Total de la programación
            </td>
            <td className="px-4 py-3 text-right text-lg font-semibold text-zinc-900">
              {hoja.totalPrendas}
            </td>
          </tr>
        </tfoot>
      </table>

      <ul className="flex flex-col divide-y divide-zinc-100 sm:hidden">
        {hoja.ordenes.map((orden) => (
          <li key={orden.id} className="p-4">
            <p className="text-base font-semibold text-zinc-900">
              {orden.turno}. {orden.razonSocial}
            </p>
            <p className="text-sm text-zinc-500">{orden.numeroOrdenCompra}</p>

            <ul className="mt-2 flex flex-col gap-1">
              {orden.referencias.map((referencia) => (
                <li
                  key={referencia.id}
                  className="flex justify-between gap-3 text-sm text-zinc-700"
                >
                  <span>{referencia.descripcion}</span>
                  <span className="font-medium text-zinc-900">
                    {referencia.cantidad}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li className="flex justify-between bg-zinc-50 px-4 py-3">
          <span className="font-medium text-zinc-700">
            Total de la programación
          </span>
          <span className="font-semibold text-zinc-900">
            {hoja.totalPrendas}
          </span>
        </li>
      </ul>
    </article>
  );
}
