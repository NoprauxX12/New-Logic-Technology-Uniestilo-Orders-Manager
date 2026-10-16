import type { OrdenEnLaHoja } from "@/features/programacion/queries";

/**
 * HU-03 · La hoja que trabaja diseño.
 *
 * Las cuatro columnas que pide la historia: número de orden de programación,
 * razón social, cada referencia y el total de esa referencia. Sin tallas y sin
 * valor unitario — ni siquiera se consultan.
 *
 * En celular la tabla no cabe, así que la misma información se apila en
 * tarjetas; es la misma lista, no otra pantalla.
 */

export function HojaDeProgramacion({ ordenes }: { ordenes: OrdenEnLaHoja[] }) {
  if (ordenes.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
        Todavía no hay órdenes programadas a diseño.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white sm:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Órdenes programadas a diseño, en el orden en que deben trabajarse
          </caption>
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th
                scope="col"
                className="px-4 py-3 text-sm font-medium text-zinc-600"
              >
                # programación
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-sm font-medium text-zinc-600"
              >
                Razón social
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-sm font-medium text-zinc-600"
              >
                Referencia
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-sm font-medium text-zinc-600"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenes.map((orden) => (
              <tr
                key={orden.id}
                className="border-b border-zinc-100 last:border-0"
              >
                <td className="px-4 py-4 align-top font-semibold text-zinc-900">
                  {orden.numeroOrdenProgramacion}
                </td>
                <td className="px-4 py-4 align-top text-zinc-900">
                  {orden.razonSocial}
                  <span className="block text-sm text-zinc-500">
                    {orden.numeroOrdenCompra}
                  </span>
                </td>
                <td className="px-4 py-4 align-top text-zinc-700">
                  <ul>
                    {orden.referencias.map((referencia) => (
                      <li key={referencia.id}>{referencia.descripcion}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-4 text-right align-top text-zinc-700">
                  <ul>
                    {orden.referencias.map((referencia) => (
                      <li key={referencia.id}>{referencia.cantidad}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 sm:hidden">
        {ordenes.map((orden) => (
          <li
            key={orden.id}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <p className="text-sm font-medium text-zinc-500">
              Programación {orden.numeroOrdenProgramacion}
            </p>
            <p className="text-base font-semibold text-zinc-900">
              {orden.razonSocial}
            </p>
            <p className="text-sm text-zinc-500">{orden.numeroOrdenCompra}</p>

            <ul className="mt-3 flex flex-col gap-1">
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
      </ul>
    </>
  );
}
