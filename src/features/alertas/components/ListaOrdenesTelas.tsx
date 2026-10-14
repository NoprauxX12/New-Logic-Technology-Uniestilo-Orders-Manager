import { FormularioAvisoTela } from "@/features/alertas/components/FormularioAvisoTela";
import type { OrdenParaTelas } from "@/features/alertas/queries";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-06 · Las órdenes en las que secretaría valida la tela.
 *
 * Cada tarjeta muestra una de tres cosas, según lo que digan las reglas:
 * el aviso que ya se envió, el formulario para avisar, o por qué esta persona
 * no puede avisar. Nunca las dos primeras a la vez, para que no se avise dos
 * veces por la misma orden.
 */

type Props = {
  ordenes: OrdenParaTelas[];
};

function formatearMomento(momentoIso: string): string {
  return new Date(momentoIso).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function ListaOrdenesTelas({ ordenes }: Props) {
  if (ordenes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
        <p className="font-medium text-zinc-900">
          No hay órdenes esperando el corte
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Cuando se registre una orden nueva, aparecerá aquí para validar su
          tela.
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
          <header className="mb-4">
            <p className="text-sm font-medium text-zinc-500">Orden de compra</p>
            <h2 className="text-lg font-semibold text-zinc-900">
              {orden.numeroOrdenCompra}
            </h2>
            <p className="mt-1 text-sm text-zinc-700">{orden.razonSocial}</p>
            <p className="mt-1 text-sm text-zinc-500">
              Entrega: {formatearFecha(orden.fechaEntrega)}
            </p>
          </header>

          {orden.avisoPendiente ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-base font-medium text-amber-900">
                Se avisó que falta tela
              </p>
              <p className="text-base text-amber-900">
                {orden.avisoPendiente.detalle}
              </p>
              <p className="mt-1 text-sm text-amber-800">
                Enviado el{" "}
                {formatearMomento(orden.avisoPendiente.fechaCreacion)}.
                Administración lo tiene pendiente.
              </p>
            </div>
          ) : orden.veredicto.permitido ? (
            <FormularioAvisoTela ordenId={orden.id} />
          ) : (
            <p className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-zinc-700">
              {orden.veredicto.mensaje}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
