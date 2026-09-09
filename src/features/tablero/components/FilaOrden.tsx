import Link from "next/link";

import { BadgeSemaforo } from "@/features/tablero/components/BadgeSemaforo";
import type { EtapaTablero, OrdenEnTablero } from "@/features/tablero/types";
import type { CheckpointId } from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";

/** Etiquetas cortas para la fila del tablero (el nombre completo va en title + detalle). */
const ETIQUETA_CORTA: Record<CheckpointId, string> = {
  cotizacion_aprobada: "Cotizac.",
  programada_diseno: "Diseño",
  ficha_adjunta: "Ficha",
  tela_programada: "Tela",
  corte_completado: "Corte",
  recogido_bordado: "Bordado",
  llegada_marcacion: "Marcación",
  lista_despacho: "Despacho",
  etiquetas: "Etiquetas",
  documentos_despacho: "Docs.",
  factura_generada: "Factura",
  cerrada: "Cierre",
};

function formatoCorto(iso: string) {
  const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
}

function NodoEtapa({ etapa }: { etapa: EtapaTablero }) {
  const completada = etapa.estado === "completada";
  return (
    <li
      className="flex w-14 shrink-0 flex-col items-center gap-1"
      title={etapa.etiqueta}
    >
      <span
        className={[
          "flex size-7 items-center justify-center rounded-full text-xs",
          completada
            ? "bg-emerald-100 text-emerald-800"
            : "bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200",
        ].join(" ")}
        aria-label={`${etapa.etiqueta}: ${completada ? "completada" : "pendiente"}`}
      >
        {completada ? "✓" : ""}
      </span>
      <span className="w-full text-center text-[10px] leading-tight text-zinc-500">
        {ETIQUETA_CORTA[etapa.seccion]}
      </span>
      {completada && etapa.avance ? (
        <span className="text-[10px] text-zinc-400 tabular-nums">
          {formatoCorto(etapa.avance.fechaHora)}
        </span>
      ) : (
        <span className="text-[10px] text-transparent">00/00</span>
      )}
    </li>
  );
}

export function FilaOrden({ orden }: { orden: OrdenEnTablero }) {
  // A quién le toca mover la orden. Es lo que hace visible que, al marcarla
  // lista para despachar, la orden le queda a secretaría para el cierre.
  const sigue = loQueSigue(
    orden.etapas
      .filter((etapa) => etapa.estado === "completada")
      .map((etapa) => etapa.seccion),
  );

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">
              {orden.numeroOrdenCompra}
            </h2>
            <BadgeSemaforo semaforo={orden.semaforo} />
          </div>
          <p className="text-sm text-zinc-700">{orden.razonSocial}</p>
          <p className="text-sm text-zinc-500">
            {orden.cantidad} uds · {orden.prenda}
          </p>
          <p className="text-xs text-zinc-500">
            Entrega {formatoCorto(orden.fechaEntrega)}
          </p>
          {sigue ? (
            <p className="text-xs font-medium text-stone-700">
              Sigue: {sigue.checkpoint.etiqueta} — {sigue.responsable}
            </p>
          ) : (
            <p className="text-xs font-medium text-emerald-700">
              Orden terminada
            </p>
          )}
        </div>
      </div>

      {/* Línea de tiempo a ancho completo: evita comprimir las etapas al lado del texto */}
      <ol
        className="mt-4 flex gap-0 overflow-x-auto border-t border-zinc-100 pt-4 pb-1"
        aria-label="Avance por etapa"
      >
        {orden.etapas.map((etapa) => (
          <NodoEtapa key={etapa.seccion} etapa={etapa} />
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-zinc-100 pt-3">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-zinc-500">Prenda</dt>
            <dd className="text-zinc-800">{orden.prenda}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Cantidad</dt>
            <dd className="text-zinc-800">{orden.cantidad} unidades</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Recibido</dt>
            <dd className="text-zinc-800">{orden.fechaRecepcion}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Taller</dt>
            <dd className="text-zinc-800">{orden.tallerNombre ?? "—"}</dd>
          </div>
        </dl>

        <Link
          href={`/tablero/${orden.id}`}
          className="inline-flex items-center justify-center rounded-lg bg-stone-700 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          Ver trazabilidad completa →
        </Link>
      </div>
    </article>
  );
}
