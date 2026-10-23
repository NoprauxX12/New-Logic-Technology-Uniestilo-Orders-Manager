import Link from "next/link";

import { BadgeSemaforo } from "@/components/BadgeSemaforo";
import { etapaDevuelta } from "@/lib/ordenes/reglas";
import type { EtapaTablero, OrdenEnTablero } from "@/lib/ordenes/types";
import type { CheckpointId } from "@/features/workflow/checkpoints";
import { loQueSigue } from "@/features/workflow/estado";

/** Etiquetas cortas para la fila del tablero (el nombre completo va en title + detalle). */
const ETIQUETA_CORTA: Record<CheckpointId, string> = {
  cotizacion_enviada: "Cotiz. env.",
  cotizacion_aprobada: "Cotiz. apr.",
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

type Tramo = "hecho" | "pendiente" | "no_aplico";

/**
 * El tramo de línea que llega a la etapa `i`: verde hasta la última etapa
 * completada, gris después, y gris punteado si llega a una que no aplicó.
 */
function tramoHacia(etapas: EtapaTablero[], i: number): Tramo {
  const ultima = etapas.reduce(
    (idx, etapa, n) => (etapa.estado === "completada" ? n : idx),
    -1,
  );
  if (etapas[i].estado === "no_aplico") return "no_aplico";
  return i <= ultima ? "hecho" : "pendiente";
}

const CLASE_TRAMO: Record<Tramo, string> = {
  hecho: "border-t-2 border-solid border-emerald-500",
  pendiente: "border-t-2 border-solid border-zinc-200",
  no_aplico: "border-t-2 border-dashed border-zinc-300",
};

function NodoEtapa({
  etapa,
  devuelta,
  izquierda,
  derecha,
}: {
  etapa: EtapaTablero;
  /** HU-18: es la etapa a la que se devolvió la orden y aún no se rehace. */
  devuelta: boolean;
  /** Tramo que llega desde la etapa anterior; null en la primera. */
  izquierda: Tramo | null;
  /** Tramo que sale hacia la etapa siguiente; null en la última. */
  derecha: Tramo | null;
}) {
  const completada = etapa.estado === "completada";
  const noAplico = etapa.estado === "no_aplico";
  return (
    <li
      className="flex w-14 shrink-0 flex-col items-center gap-1"
      title={
        noAplico
          ? `${etapa.etiqueta} (no aplicó)`
          : devuelta
            ? `${etapa.etiqueta} (devuelta)`
            : etapa.etiqueta
      }
    >
      {/* Cada mitad de línea mide la mitad del nodo (w-1/2): juntas
          forman una sola línea que pasa por el centro de los círculos (size-7). */}
      <div className="relative flex h-7 w-full items-center justify-center">
        {izquierda ? (
          <span
            aria-hidden="true"
            className={`absolute top-1/2 left-0 w-1/2 -translate-y-1/2 ${CLASE_TRAMO[izquierda]}`}
          />
        ) : null}
        {derecha ? (
          <span
            aria-hidden="true"
            className={`absolute top-1/2 right-0 w-1/2 -translate-y-1/2 ${CLASE_TRAMO[derecha]}`}
          />
        ) : null}
        <span
          className={[
            "relative flex size-7 items-center justify-center rounded-full text-xs",
            completada
              ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500"
              : devuelta
                ? "bg-amber-100 text-amber-900 ring-1 ring-amber-500"
                : noAplico
                  ? "ring-dashed bg-zinc-50 text-zinc-400 ring-1 ring-zinc-200"
                  : "bg-zinc-100 text-zinc-400 ring-1 ring-zinc-200",
          ].join(" ")}
          aria-label={`${etapa.etiqueta}: ${completada ? "completada" : devuelta ? "devuelta" : noAplico ? "no aplicó" : "pendiente"}`}
        >
          {completada ? "✓" : devuelta ? "↩" : noAplico ? "–" : ""}
        </span>
      </div>
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
    orden.etapaInicial,
  );

  // HU-18: la etapa a la que se devolvió la orden y que todavía no se rehace.
  const seccionDevuelta = etapaDevuelta(orden.etapas, orden.devoluciones);
  const devuelta = orden.etapas.find(
    (etapa) => etapa.seccion === seccionDevuelta,
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
            {orden.ordenOriginal ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                Corrección de {orden.ordenOriginal.numeroOrdenCompra}
              </span>
            ) : null}
            {devuelta ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                Devuelta a {devuelta.etiqueta}
              </span>
            ) : null}
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
          {orden.tieneFicha ? (
            <p className="text-xs font-medium text-emerald-800">
              Ficha técnica adjunta
            </p>
          ) : null}
        </div>
      </div>

      {/* Línea de tiempo a ancho completo: evita comprimir las etapas al lado del texto */}
      <ol
        className="mt-4 flex gap-0 overflow-x-auto border-t border-zinc-100 pt-4 pb-1"
        aria-label="Avance por etapa"
      >
        {orden.etapas.map((etapa, i, etapas) => (
          <NodoEtapa
            key={etapa.seccion}
            etapa={etapa}
            devuelta={etapa.seccion === seccionDevuelta}
            izquierda={i > 0 ? tramoHacia(etapas, i) : null}
            derecha={i < etapas.length - 1 ? tramoHacia(etapas, i + 1) : null}
          />
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
            <dd className="text-xs text-stone-700">{orden.estadoTalleres}</dd>
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
