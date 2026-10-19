import { BotonAtenderAlerta } from "@/features/alertas/components/BotonAtenderAlerta";
import type { AlertaTelaEnTablero } from "@/features/alertas/queries";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-07 · Las alertas de tela pendientes, arriba del tablero de administración.
 *
 * Si no hay ninguna, no ocupa espacio: resuelta significa que desaparece.
 */

type Props = {
  alertas: readonly AlertaTelaEnTablero[];
};

export function ListaAlertasTablero({ alertas }: Props) {
  if (alertas.length === 0) return null;

  return (
    <section aria-label="Alertas de tela" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-900">Alertas de tela</h2>
      <ul className="flex flex-col gap-3">
        {alertas.map((alerta) => (
          <li
            key={alerta.id}
            className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
          >
            <div className="space-y-1">
              <p className="text-base font-semibold text-amber-950">
                Falta tela en {alerta.numeroOrdenCompra}
              </p>
              <p className="text-sm text-amber-950">
                {alerta.razonSocial} · avisó {alerta.enviadaPor} el{" "}
                {formatearFecha(alerta.fechaCreacion.slice(0, 10))}
              </p>
              <p className="text-base text-zinc-900">{alerta.detalle}</p>
            </div>
            <BotonAtenderAlerta alertaId={alerta.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
