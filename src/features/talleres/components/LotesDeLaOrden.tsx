import { FormularioConfirmarRecepcion } from "@/features/talleres/components/FormularioConfirmarRecepcion";
import type { LoteDespachado } from "@/features/talleres/queries";

/**
 * HU-10 y HU-11 · Los lotes que una orden ya mandó a taller, y para los que
 * siguen afuera, el formulario de recepción si quien mira es de logística.
 */

function formatearMomento(momentoIso: string): string {
  return new Date(momentoIso).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    // La empresa tiene una sola sede; sin esto, en Vercel se leería en UTC.
    timeZone: "America/Bogota",
  });
}

function TarjetaLote({
  lote,
  ordenId,
  puedeConfirmar,
}: {
  lote: LoteDespachado;
  ordenId: string;
  puedeConfirmar: boolean;
}) {
  return (
    <li className="rounded-lg border border-zinc-300 bg-white px-4 py-3">
      <p className="text-base font-semibold text-zinc-900">{lote.taller}</p>
      <p className="text-base text-zinc-700">{lote.descripcionPrendas}</p>
      <p className="mt-1 text-sm text-zinc-600">
        Despachado el {formatearMomento(lote.fechaEnvio)}
        {lote.enviadoPor ? ` por ${lote.enviadoPor}` : ""}
      </p>
      <p className="text-sm font-medium text-zinc-700">
        {lote.recibido ? "Ya volvió del taller" : "Todavía en el taller"}
      </p>
      {lote.observacionesRecepcion ? (
        <p className="text-sm text-zinc-600">{lote.observacionesRecepcion}</p>
      ) : null}

      {!lote.recibido && puedeConfirmar ? (
        <div className="mt-3">
          <FormularioConfirmarRecepcion
            ordenId={ordenId}
            loteId={lote.id}
            descripcionPrendas={lote.descripcionPrendas}
          />
        </div>
      ) : null}
    </li>
  );
}

type Props = {
  ordenId: string;
  lotes: LoteDespachado[];
  /** HU-11: solo logística confirma, y solo los lotes que siguen afuera. */
  puedeConfirmar: boolean;
};

export function LotesDeLaOrden({ ordenId, lotes, puedeConfirmar }: Props) {
  if (lotes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-zinc-900">
        Lotes enviados a taller
      </h2>
      <ul className="flex flex-col gap-3">
        {lotes.map((lote) => (
          <TarjetaLote
            key={lote.id}
            lote={lote}
            ordenId={ordenId}
            puedeConfirmar={puedeConfirmar}
          />
        ))}
      </ul>
    </section>
  );
}
