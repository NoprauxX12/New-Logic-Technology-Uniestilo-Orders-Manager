"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";

import { BadgeSemaforo } from "@/components/BadgeSemaforo";
import { FichasAdjuntas } from "@/components/FichasAdjuntas";
import {
  marcarCheckpoint,
  type EstadoMarcado,
} from "@/features/workflow/actions";
import {
  agruparOrdenesDeSeccion,
  DIAS_DE_MARCADAS,
  ordenarPorAntiguedad,
  ordenarPorLlegada,
} from "@/features/workflow/agrupacion";
import {
  buscarCheckpoint,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import type { OrdenParaSeccion } from "@/features/workflow/queries";
import { derivarSemaforo } from "@/lib/ordenes/reglas";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * La lista con la que una sección marca su etapa: una tarjeta por orden y un
 * solo botón (RNF-08). Sirve para corte (HU-08), marcación (HU-12) y cualquier
 * etapa que tenga pantalla propia; lo que cambia es el `checkpoint`.
 *
 * La lista contesta «¿qué hago ahora?», no «¿qué órdenes hay?»: arriba lo que le
 * toca marcar a la sección, por urgencia; debajo y plegado lo que todavía no
 * llega; y al final, plegado, lo que ya marcó esta semana. Las órdenes cerradas
 * no se muestran (ver `agrupacion.ts`).
 *
 * Cuando el motor no deja marcar, el botón queda deshabilitado con el motivo al
 * lado, en lenguaje del taller, en vez de desaparecer.
 */

type Props = {
  ordenes: OrdenParaSeccion[];
  checkpoint: CheckpointId;
  /**
   * Cómo se ordena lo que toca marcar. Por defecto, por urgencia (atrasadas
   * primero). `llegada` pone primero la que lleva más tiempo esperando desde que
   * entró el pedido; `antiguedad`, la que lleva más tiempo en su estado.
   */
  ordenarPor?: "urgencia" | "llegada" | "antiguedad";
  /** Sin el título del primer grupo: para las pantallas que ya traen los suyos. */
  conTitulos?: boolean;
  /**
   * Si se pasa, cada tarjeta dice desde cuándo espera: «<leyenda> hace 3 días»,
   * contando desde `fechaMarcado` (por ejemplo, «Cotización enviada»).
   */
  leyendaDesde?: string;
};

const MS_DIA = 24 * 60 * 60 * 1000;

function haceCuanto(desde: string, ahora: Date): string {
  const dias = Math.floor((ahora.getTime() - Date.parse(desde)) / MS_DIA);
  if (dias <= 0) return "hoy";
  return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

export function ListaOrdenesSeccion({
  ordenes,
  checkpoint,
  ordenarPor = "urgencia",
  conTitulos = true,
  leyendaDesde,
}: Props) {
  const [aviso, setAviso] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const agrupadas = agruparOrdenesDeSeccion(ordenes);
    if (ordenarPor === "llegada") {
      agrupadas.paraMarcar = ordenarPorLlegada(agrupadas.paraMarcar);
    } else if (ordenarPor === "antiguedad") {
      agrupadas.paraMarcar = ordenarPorAntiguedad(agrupadas.paraMarcar);
    }
    return agrupadas;
  }, [ordenes, ordenarPor]);

  if (ordenes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
        <p className="font-medium text-zinc-900">No hay órdenes registradas</p>
        <p className="mt-1 text-sm text-zinc-600">
          Cuando se registre una orden, aparecerá en esta lista.
        </p>
      </div>
    );
  }

  const { paraMarcar, enEspera, hechas } = grupos;
  const tarjetas = (lista: OrdenParaSeccion[]) => (
    <ul className="flex flex-col gap-4">
      {lista.map((orden) => (
        <li key={orden.id}>
          <TarjetaOrden
            orden={orden}
            checkpoint={checkpoint}
            leyendaDesde={leyendaDesde}
            alMarcar={setAviso}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-8">
      {aviso ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
        >
          {aviso}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        {conTitulos ? (
          <h2 className="text-lg font-semibold text-zinc-900">
            Para marcar ahora{" "}
            <span className="font-normal text-zinc-500">
              ({paraMarcar.length})
            </span>
          </h2>
        ) : null}

        {paraMarcar.length > 0 ? (
          tarjetas(paraMarcar)
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
            <p className="font-medium text-zinc-900">
              No hay órdenes para marcar ahora
            </p>
            {enEspera.length > 0 ? (
              <p className="mt-1 text-sm text-zinc-600">
                {enEspera.length === 1
                  ? "Hay 1 orden esperando que termine una etapa anterior."
                  : `Hay ${enEspera.length} órdenes esperando que terminen etapas anteriores.`}
              </p>
            ) : null}
          </div>
        )}
      </section>

      {enEspera.length > 0 ? (
        <details className="group rounded-xl border border-zinc-200 bg-white">
          <summary className="min-h-12 cursor-pointer px-5 py-3 text-base font-semibold text-zinc-800">
            Todavía no llegan a esta etapa ({enEspera.length})
          </summary>
          <div className="border-t border-zinc-100 p-4">
            {tarjetas(enEspera)}
          </div>
        </details>
      ) : null}

      {hechas.length > 0 ? (
        <details className="group rounded-xl border border-zinc-200 bg-white">
          <summary className="min-h-12 cursor-pointer px-5 py-3 text-base font-semibold text-zinc-800">
            Marcadas en los últimos {DIAS_DE_MARCADAS} días ({hechas.length})
          </summary>
          <div className="border-t border-zinc-100 p-4">{tarjetas(hechas)}</div>
        </details>
      ) : null}
    </div>
  );
}

function TarjetaOrden({
  orden,
  checkpoint,
  leyendaDesde,
  alMarcar,
}: {
  orden: OrdenParaSeccion;
  checkpoint: CheckpointId;
  leyendaDesde?: string;
  /** El aviso de éxito sube a la lista: al marcar, la tarjeta cambia de grupo. */
  alMarcar: (mensaje: string) => void;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [estado, setEstado] = useState<EstadoMarcado | null>(null);
  const idMotivo = useId();

  const { etiqueta } = buscarCheckpoint(checkpoint);
  const accion = `Marcar ${etiqueta.toLowerCase()}`;
  const ahora = new Date();

  function marcar() {
    setEstado(null);
    iniciarTransicion(async () => {
      const resultado = await marcarCheckpoint(orden.id, checkpoint);
      if (resultado.ok) {
        alMarcar(resultado.mensaje);
        router.refresh();
        return;
      }
      setEstado(resultado);
    });
  }

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Orden de compra</p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-900">
              {orden.numeroOrdenCompra}
            </h3>
            {orden.yaMarcada ? null : (
              <BadgeSemaforo
                semaforo={derivarSemaforo(orden.fechaEntrega, ahora)}
              />
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-700">{orden.razonSocial}</p>
          <p className="mt-1 text-sm text-zinc-500">
            Entrega: {formatearFecha(orden.fechaEntrega)}
          </p>
          {leyendaDesde && !orden.yaMarcada && orden.fechaMarcado ? (
            <p className="mt-1 text-sm font-medium text-zinc-700">
              {leyendaDesde} {haceCuanto(orden.fechaMarcado, ahora)}
            </p>
          ) : null}
          {orden.yaMarcada && orden.fechaMarcado ? (
            <p className="mt-1 text-sm text-zinc-500">
              Marcada el {formatearFecha(orden.fechaMarcado.slice(0, 10))}
            </p>
          ) : null}
        </div>

        {orden.yaMarcada ? (
          <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-100 px-4 py-2 font-medium text-emerald-800">
            {etiqueta}
          </span>
        ) : orden.veredicto.permitido ? (
          <button
            type="button"
            disabled={pendiente}
            onClick={marcar}
            className="min-h-12 rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {pendiente ? "Guardando…" : accion}
          </button>
        ) : (
          <div className="flex flex-col gap-2 sm:items-end">
            <button
              type="button"
              disabled
              aria-describedby={idMotivo}
              className="min-h-12 rounded-lg bg-zinc-400 px-5 font-semibold text-white"
            >
              {accion}
            </button>
            <p id={idMotivo} className="text-sm text-zinc-700 sm:text-right">
              {orden.veredicto.mensaje}
            </p>
          </div>
        )}
      </div>

      {orden.fichas.length > 0 ? (
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="mb-1 text-sm font-medium text-zinc-700">
            Ficha técnica
          </p>
          <FichasAdjuntas fichas={orden.fichas} />
        </div>
      ) : null}

      {estado?.mensaje ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {estado.mensaje}
        </p>
      ) : null}
    </article>
  );
}
