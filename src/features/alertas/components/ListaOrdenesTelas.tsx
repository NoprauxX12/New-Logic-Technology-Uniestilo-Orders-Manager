import { FichasAdjuntas } from "@/components/FichasAdjuntas";
import { BotonLlegadaTela } from "@/features/alertas/components/BotonLlegadaTela";
import { FormularioAvisoTela } from "@/features/alertas/components/FormularioAvisoTela";
import type { OrdenParaTelas } from "@/features/alertas/queries";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-06 y HU-22 · Las órdenes en las que secretaría valida la tela.
 *
 * Cada tarjeta está en uno de dos estados, según lo que digan las reglas:
 *
 * - esperando tela: el aviso que se envió, y el botón para marcar que llegó
 *   (HU-22). No se ofrece avisar otra vez: ya se avisó.
 * - sin espera: el formulario para avisar (HU-06), con la fecha en que llegó la
 *   tela del último aviso si la hubo, que es la confirmación de HU-22.
 *
 * Si quien mira no puede hacer algo (administración entra, pero no avisa ni
 * recibe), se le dice por qué en vez del formulario o el botón.
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

function Motivo({ mensaje }: { mensaje: string }) {
  return (
    <p className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-zinc-700">
      {mensaje}
    </p>
  );
}

function TarjetaEsperandoTela({ orden }: { orden: OrdenParaTelas }) {
  const aviso = orden.avisoAbierto;
  if (!aviso) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="text-base font-medium text-amber-900">
          Esperando tela · no puede pasar a corte
        </p>
        <p className="text-base text-amber-900">{aviso.detalle}</p>
        <p className="mt-1 text-sm text-amber-800">
          Avisado el {formatearMomento(aviso.fechaCreacion)}.{" "}
          {aviso.atendido
            ? "Administración ya hizo el pedido."
            : "Administración todavía no lo ha atendido."}
        </p>
      </div>

      {orden.veredictoLlegada.permitido ? (
        <BotonLlegadaTela ordenId={orden.id} />
      ) : (
        <Motivo mensaje={orden.veredictoLlegada.mensaje} />
      )}
    </div>
  );
}

function TarjetaSinEspera({ orden }: { orden: OrdenParaTelas }) {
  return (
    <div className="flex flex-col gap-3">
      {orden.ultimaLlegada ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
        >
          La tela llegó el {formatearMomento(orden.ultimaLlegada)}. La orden
          puede pasar a corte.
        </p>
      ) : null}

      {orden.veredictoAviso.permitido ? (
        <FormularioAvisoTela ordenId={orden.id} />
      ) : (
        <Motivo mensaje={orden.veredictoAviso.mensaje} />
      )}
    </div>
  );
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

          <div className="mb-4">
            <p className="mb-1 text-sm font-medium text-zinc-700">
              Ficha técnica
            </p>
            <FichasAdjuntas fichas={orden.fichas} />
          </div>

          {orden.avisoAbierto ? (
            <TarjetaEsperandoTela orden={orden} />
          ) : (
            <TarjetaSinEspera orden={orden} />
          )}
        </li>
      ))}
    </ul>
  );
}
