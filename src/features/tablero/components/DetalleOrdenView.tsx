import Link from "next/link";
import type { ReactNode } from "react";

import { FichasAdjuntas } from "@/components/FichasAdjuntas";
import { BadgeSemaforo } from "@/features/tablero/components/BadgeSemaforo";
import { describirQuienMarco, etapaDevuelta } from "@/lib/ordenes/reglas";
import type {
  DetalleOrden,
  Devolucion,
  EtapaTablero,
} from "@/lib/ordenes/types";
import {
  buscarCheckpoint,
  ETIQUETAS_ROL,
} from "@/features/workflow/checkpoints";

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

/**
 * Cada vez que la etapa estuvo marcada y una devolución la anuló (HU-18): quién
 * la había marcado y cuándo, y quién la devolvió, cuándo y por qué. Es la
 * bitácora original, que no se borra, contada junto a la etapa.
 */
function HistorialDeDevoluciones({
  etapa,
  devoluciones,
}: {
  etapa: EtapaTablero;
  devoluciones: Devolucion[];
}) {
  if (etapa.anulados.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-col gap-2">
      {etapa.anulados.map((anulado) => {
        const devolucion = devoluciones.find(
          (candidata) => candidata.id === anulado.devolucionId,
        );
        return (
          <li
            key={`${anulado.devolucionId}-${anulado.fechaHora}`}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          >
            <p className="font-medium">
              Devuelta
              {devolucion
                ? ` el ${formatoFechaHora(devolucion.fechaHora)} por ${devolucion.porNombre} (${ETIQUETAS_ROL.admin})`
                : ""}
            </p>
            {devolucion ? <p>Motivo: {devolucion.motivo}</p> : null}
            <p className="text-amber-900">
              Se había marcado el {formatoFechaHora(anulado.fechaHora)} por{" "}
              {describirQuienMarco(anulado.usuarioNombre, etapa.seccion)}.
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function CardEtapa({
  etapa,
  devuelta,
  devoluciones,
  esCorreccion,
}: {
  etapa: EtapaTablero;
  /** HU-18: es la etapa a la que se devolvió la orden y aún no se rehace. */
  devuelta: boolean;
  devoluciones: Devolucion[];
  esCorreccion: boolean;
}) {
  const completada = etapa.estado === "completada";
  const noAplico = etapa.estado === "no_aplico";
  // De dónde salen el enlace y el "todavía no disponible": la fuente única de
  // la secuencia (regla 4), para no mantener aparte un mapa de etapa → página.
  const { ruta, disponible } = buscarCheckpoint(etapa.seccion);
  const sePuedeIrAMarcar =
    !completada && !noAplico && disponible && ruta !== null;

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-zinc-900">{etapa.etiqueta}</h3>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-xs font-medium",
            completada
              ? "bg-emerald-50 text-emerald-800"
              : devuelta
                ? "bg-amber-100 text-amber-900"
                : "bg-zinc-100 text-zinc-600",
          ].join(" ")}
        >
          {completada
            ? "Completada"
            : devuelta
              ? "Devuelta"
              : noAplico
                ? "No aplicó"
                : disponible
                  ? "Pendiente"
                  : "Todavía no disponible"}
        </span>
      </div>

      {completada && etapa.avance ? (
        <p className="mt-2 text-sm text-zinc-600">
          Reportado por{" "}
          <span className="font-medium text-zinc-800">
            {describirQuienMarco(etapa.avance.usuarioNombre, etapa.seccion)}
          </span>{" "}
          · {formatoFechaHora(etapa.avance.fechaHora)}
        </p>
      ) : noAplico ? (
        <p className="mt-2 text-sm text-zinc-500">
          {esCorreccion
            ? "Esta orden de corrección entra al proceso más adelante: esta etapa no le toca."
            : "La orden ya iba más adelante cuando esta etapa empezó a marcarse en el sistema."}
        </p>
      ) : disponible ? (
        <p className="mt-2 text-sm text-zinc-500">Aún no marcada.</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">
          Esta parte del proceso todavía no se marca en el sistema.
        </p>
      )}

      <HistorialDeDevoluciones etapa={etapa} devoluciones={devoluciones} />

      {sePuedeIrAMarcar ? (
        <Link
          href={ruta}
          className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-stone-400 px-4 text-base font-medium text-stone-800 hover:bg-stone-100"
        >
          Ir a marcar {etapa.etiqueta.toLowerCase()}
        </Link>
      ) : null}

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
  /**
   * HU-18: lo que administración puede hacer ante un defecto —devolver la orden
   * a una etapa, o crear su orden de corrección si ya está cerrada—. También
   * llega como slot: el tablero no depende de la feature de correcciones.
   */
  correccion?: ReactNode;
};

function EnlacesDeCorreccion({ orden }: { orden: DetalleOrden }) {
  if (!orden.ordenOriginal && orden.correcciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 text-sm text-zinc-700">
      {orden.ordenOriginal ? (
        <p>
          Corrección de{" "}
          <Link
            href={`/tablero/${orden.ordenOriginal.id}`}
            className="font-medium text-stone-800 underline"
          >
            {orden.ordenOriginal.numeroOrdenCompra}
          </Link>
          {orden.etapaInicial
            ? ` · entra por «${buscarCheckpoint(orden.etapaInicial).etiqueta}»`
            : ""}
        </p>
      ) : null}
      {orden.correcciones.length > 0 ? (
        <p>
          Correcciones:{" "}
          {orden.correcciones.map((correccion, posicion) => (
            <span key={correccion.id}>
              {posicion > 0 ? ", " : ""}
              <Link
                href={`/tablero/${correccion.id}`}
                className="font-medium text-stone-800 underline"
              >
                {correccion.numeroOrdenCompra}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function DetalleOrdenView({ orden, accion, correccion }: Props) {
  const pct = Math.round((orden.etapasCompletadas / orden.etapasTotales) * 100);
  const seccionDevuelta = etapaDevuelta(orden.etapas, orden.devoluciones);

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
        <EnlacesDeCorreccion orden={orden} />

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

      {correccion}

      <section aria-labelledby="ficha-tecnica-titulo">
        <h2
          id="ficha-tecnica-titulo"
          className="mb-3 text-lg font-semibold text-zinc-900"
        >
          Ficha técnica
        </h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <FichasAdjuntas fichas={orden.fichas} conMeta />
        </div>
      </section>

      {orden.devoluciones.length > 0 ? (
        <section aria-labelledby="devoluciones-titulo">
          <h2
            id="devoluciones-titulo"
            className="mb-3 text-lg font-semibold text-zinc-900"
          >
            Devoluciones
          </h2>
          <ul className="flex flex-col gap-2">
            {orden.devoluciones.map((devolucion) => (
              <li
                key={devolucion.id}
                className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <p className="font-medium">
                  Se devolvió a «{buscarCheckpoint(devolucion.destino).etiqueta}
                  » el {formatoFechaHora(devolucion.fechaHora)} por{" "}
                  {devolucion.porNombre} ({ETIQUETAS_ROL.admin})
                </p>
                <p>Motivo: {devolucion.motivo}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="linea-tiempo-titulo">
        <h2
          id="linea-tiempo-titulo"
          className="mb-3 text-lg font-semibold text-zinc-900"
        >
          Línea de tiempo
        </h2>
        <ol className="flex flex-col gap-3">
          {orden.etapas.map((etapa) => (
            <CardEtapa
              key={etapa.seccion}
              etapa={etapa}
              devuelta={etapa.seccion === seccionDevuelta}
              devoluciones={orden.devoluciones}
              esCorreccion={orden.etapaInicial !== null}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}
