import Link from "next/link";
import type { ReactNode } from "react";

import { BadgeSemaforo } from "@/features/tablero/components/BadgeSemaforo";
import type { DetalleOrden, EtapaTablero } from "@/features/tablero/types";

function formatoFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    // Sin zona explícita se usaría la del servidor, que en Vercel es UTC: un
    // avance marcado a las 10:12 en Marinilla se leería "15:12". La bitácora
    // dice cuándo se marcó de verdad (RNF-05), y la empresa tiene una sola sede.
    timeZone: "America/Bogota",
  });
}

function CardEtapa({ etapa }: { etapa: EtapaTablero }) {
  const completada = etapa.estado === "completada";

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-zinc-900">{etapa.etiqueta}</h3>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-xs font-medium",
            completada
              ? "bg-emerald-50 text-emerald-800"
              : "bg-zinc-100 text-zinc-600",
          ].join(" ")}
        >
          {completada ? "Completada" : "Pendiente"}
        </span>
      </div>

      {completada && etapa.avance ? (
        <p className="mt-2 text-sm text-zinc-600">
          Reportado por{" "}
          <span className="font-medium text-zinc-800">
            {etapa.avance.usuarioNombre}
          </span>{" "}
          · {formatoFechaHora(etapa.avance.fechaHora)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">Aún no marcada.</p>
      )}

      {etapa.avance?.observacion ? (
        <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {etapa.avance.observacion}
        </p>
      ) : null}
    </li>
  );
}

type Props = {
  orden: DetalleOrden;
  /**
   * Lo que esta sección puede marcar en la orden, si es que le toca algo. Llega
   * como slot desde la página para que el tablero no dependa del motor de
   * marcado: quien compone decide qué acción va aquí.
   */
  accion?: ReactNode;
};

export function DetalleOrdenView({ orden, accion }: Props) {
  const pct = Math.round((orden.etapasCompletadas / orden.etapasTotales) * 100);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/tablero"
          className="text-sm font-medium text-stone-700 hover:text-stone-900"
        >
          ← Tablero
        </Link>
        <BadgeSemaforo semaforo={orden.semaforo} />
      </div>

      <header className="space-y-2 rounded-xl border border-zinc-200 bg-white p-5">
        <h1 className="text-2xl font-semibold text-zinc-900">
          {orden.numeroOrdenCompra}
        </h1>
        <p className="text-zinc-700">{orden.razonSocial}</p>
        <p className="text-sm text-zinc-600">
          {orden.prenda} · {orden.cantidad} unidades
        </p>
        <p className="text-sm text-zinc-600">
          Entrega {orden.fechaEntrega}
          {orden.tallerNombre ? ` · ${orden.tallerNombre}` : ""}
        </p>

        <div className="pt-3">
          <div className="mb-1 flex justify-between text-xs text-zinc-500">
            <span>Progreso general</span>
            <span>
              {orden.etapasCompletadas}/{orden.etapasTotales} etapas ({pct}%)
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </header>

      {accion}

      <section aria-labelledby="linea-tiempo-titulo">
        <h2
          id="linea-tiempo-titulo"
          className="mb-3 text-lg font-semibold text-zinc-900"
        >
          Línea de tiempo
        </h2>
        <ol className="flex flex-col gap-3">
          {orden.etapas.map((etapa) => (
            <CardEtapa key={etapa.seccion} etapa={etapa} />
          ))}
        </ol>
      </section>
    </div>
  );
}
