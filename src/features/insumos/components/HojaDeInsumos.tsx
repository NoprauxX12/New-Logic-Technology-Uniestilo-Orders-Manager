import { ListadoDeInsumos } from "@/features/insumos/components/ListadoDeInsumos";
import { PrendasDeLaOrden } from "@/features/insumos/components/PrendasDeLaOrden";
import type { ListadoDeInsumos as Listado } from "@/features/insumos/queries";
import { formatearDia, formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-23 · La hoja que se imprime: los datos de la orden de compra, sus prendas
 * y el listado de insumos. Si todavía no se validan, la hoja lo dice; así sirve
 * también para ir a revisar la bodega antes de validar.
 */
export function HojaDeInsumos({ listado }: { listado: Listado }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-6 print:border-0 print:p-0">
      <header className="border-b border-zinc-200 pb-4">
        <p className="text-sm font-medium text-zinc-500">
          Uniestilo · Listado de insumos
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Orden de compra {listado.numeroOrdenCompra}
        </h1>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Dato nombre="Cliente" valor={listado.razonSocial} />
          <Dato nombre="NIT" valor={listado.nit} />
          <Dato
            nombre="Contacto"
            valor={`${listado.contactoNombre} · ${listado.contactoCelular}`}
          />
          <Dato
            nombre="Ingreso del pedido"
            valor={formatearFecha(listado.fechaIngreso)}
          />
          <Dato nombre="Entrega" valor={formatearFecha(listado.fechaEntrega)} />
        </dl>
        {listado.observaciones ? (
          <p className="mt-2 text-sm text-zinc-700">
            Observaciones: {listado.observaciones}
          </p>
        ) : null}
      </header>

      <section className="mt-4">
        <PrendasDeLaOrden prendas={listado.prendas} />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold text-zinc-900">Insumos</h2>
        <ListadoDeInsumos listado={listado.listado} />
        {listado.validacion ? (
          <p className="mt-2 text-sm text-zinc-600">
            Validados por {listado.validacion.por} el{" "}
            {formatearDia(listado.validacion.fechaHora)}.
          </p>
        ) : null}
      </section>
    </article>
  );
}

function Dato({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500">{nombre}:</dt>
      <dd className="font-medium text-zinc-900">{valor}</dd>
    </div>
  );
}
