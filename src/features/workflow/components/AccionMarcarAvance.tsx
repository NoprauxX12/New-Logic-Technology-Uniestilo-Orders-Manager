"use client";

import { useActionState, useId } from "react";

import { marcarAvance, type EstadoMarcado } from "@/features/workflow/actions";
import {
  buscarCheckpoint,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import type { ResultadoMarcado } from "@/features/workflow/transiciones";

/**
 * El botón con el que una sección marca su parte de la orden.
 *
 * Cuando el motor no deja marcar, el botón queda deshabilitado con el motivo al
 * lado en vez de desaparecer: ese motivo —"Antes hay que marcar «Llegada a
 * marcación»"— es justamente el criterio 2 de HU-19 explicado en lenguaje del
 * taller, y una pantalla cuyos botones aparecen y desaparecen se lee como si la
 * aplicación estuviera rota (RNF-08/09/10). La excepción es un checkpoint ya
 * marcado: ahí no se pinta nada, porque la línea de etapas ya lo muestra con su
 * autor y su hora.
 *
 * El veredicto llega calculado desde el servidor y solo decide qué se pinta; la
 * action lo vuelve a calcular con datos leídos de la base antes de escribir.
 */

const ESTADO_INICIAL: EstadoMarcado = { ok: false, mensaje: "" };

type Props = {
  ordenId: string;
  checkpoint: CheckpointId;
  veredicto: ResultadoMarcado;
};

export function AccionMarcarAvance({ ordenId, checkpoint, veredicto }: Props) {
  const [estado, marcar, marcando] = useActionState(
    marcarAvance,
    ESTADO_INICIAL,
  );
  const idMotivo = useId();

  const { etiqueta } = buscarCheckpoint(checkpoint);
  const accion = `Marcar ${etiqueta.toLowerCase()}`;

  const aviso = estado.mensaje ? (
    <p
      role={estado.ok ? "status" : "alert"}
      className={
        estado.ok
          ? "rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
          : "rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
      }
    >
      {estado.mensaje}
    </p>
  ) : null;

  // Ya marcado: la línea de etapas lo cuenta mejor que un botón gris.
  if (!veredicto.permitido && veredicto.motivo === "ya_marcado") {
    return aviso;
  }

  return (
    <div className="flex flex-col gap-3">
      {aviso}

      {veredicto.permitido ? (
        <form action={marcar}>
          <input type="hidden" name="ordenId" value={ordenId} />
          <input type="hidden" name="checkpoint" value={checkpoint} />
          <button
            type="submit"
            disabled={marcando}
            className="min-h-14 w-full rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400 sm:w-auto"
          >
            {marcando ? "Marcando…" : accion}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled
            aria-describedby={idMotivo}
            className="min-h-14 w-full rounded-lg bg-zinc-400 px-6 text-lg font-semibold text-white sm:w-auto"
          >
            {accion}
          </button>
          <p id={idMotivo} className="text-base text-zinc-700">
            {veredicto.mensaje}
          </p>
        </div>
      )}
    </div>
  );
}
