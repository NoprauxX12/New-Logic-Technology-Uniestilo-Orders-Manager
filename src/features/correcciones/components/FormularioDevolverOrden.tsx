"use client";

import { useActionState, useState } from "react";

import {
  devolverOrden,
  type EstadoDevolucion,
} from "@/features/correcciones/actions";
import {
  etapasParaDevolver,
  etapasQueQuedanVigentes,
  etapasQueSeAnulan,
  MOTIVO_MAXIMO,
} from "@/features/correcciones/reglas";
import {
  buscarCheckpoint,
  ETIQUETAS_ROL,
  type CheckpointId,
} from "@/features/workflow/checkpoints";
import { siguienteCheckpoint } from "@/features/workflow/transiciones";

/**
 * HU-18 · "Devolver la orden a una etapa" (solo administración).
 *
 * Una sola decisión por pantalla: a qué etapa vuelve la orden y por qué. Antes
 * de enviar se dice con todas las letras lo que va a pasar —qué etapas quedan
 * anuladas, que nada se borra y a quién le toca después—, porque es la acción
 * más delicada del tablero. Va plegada: no es lo que se hace todos los días.
 *
 * Lo que se pinta lo calculan las reglas puras; la action las vuelve a aplicar
 * con datos de la base, y la función de Postgres las repite.
 */

const ESTADO_INICIAL: EstadoDevolucion = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: { ordenId: "", checkpoint: "", motivo: "" },
};

type Props = {
  ordenId: string;
  /** Los avances vigentes de la orden. */
  marcados: CheckpointId[];
  /** Por qué etapa entró, si es una orden de corrección. */
  etapaInicial?: CheckpointId | null;
};

function lista(etapas: CheckpointId[]): string {
  const nombres = etapas.map((id) => `«${buscarCheckpoint(id).etiqueta}»`);
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

export function FormularioDevolverOrden({
  ordenId,
  marcados,
  etapaInicial = null,
}: Props) {
  const [estado, devolver, devolviendo] = useActionState(
    devolverOrden,
    ESTADO_INICIAL,
  );
  const opciones = etapasParaDevolver(marcados);
  const [elegido, setDestino] = useState<CheckpointId | "">("");

  // Tras devolver, la etapa elegida ya no está vigente: se vuelve a "Elige…".
  const destino = opciones.find((id) => id === elegido) ?? "";

  // Sin etapas a las que volver solo queda el aviso del resultado (la orden
  // acaba de volver a la primera etapa) o nada, si nunca hubo.
  if (opciones.length === 0) {
    return estado.ok ? (
      <p
        role="status"
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
      >
        {estado.mensaje}
      </p>
    ) : null;
  }

  const seAnulan = destino ? etapasQueSeAnulan(marcados, destino) : [];
  const siguiente = destino
    ? siguienteCheckpoint(
        etapasQueQuedanVigentes(marcados, destino),
        etapaInicial,
      )
    : null;

  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-4">
      <summary className="flex min-h-12 cursor-pointer items-center text-lg font-semibold text-zinc-900">
        Devolver la orden a una etapa
      </summary>

      <form action={devolver} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="ordenId" value={ordenId} />

        <p className="text-base text-zinc-700">
          Úsalo cuando se encuentra un defecto y hay que rehacer una parte. Lo
          que ya se marcó no se borra: queda en el historial como devuelto.
        </p>

        {estado.mensaje ? (
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
        ) : null}

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`devolver-etapa-${ordenId}`}
            className="text-base font-medium text-zinc-900"
          >
            ¿A qué etapa vuelve la orden?
          </label>
          <select
            id={`devolver-etapa-${ordenId}`}
            name="checkpoint"
            value={destino}
            onChange={(evento) =>
              setDestino(
                opciones.find((id) => id === evento.target.value) ?? "",
              )
            }
            aria-invalid={Boolean(estado.errores.checkpoint)}
            className="min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:ring-2 focus:ring-stone-500 focus:outline-none"
          >
            <option value="">Elige una etapa…</option>
            {opciones.map((id) => (
              <option key={id} value={id}>
                {buscarCheckpoint(id).etiqueta}
              </option>
            ))}
          </select>
          {estado.errores.checkpoint ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {estado.errores.checkpoint[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor={`devolver-motivo-${ordenId}`}
            className="text-base font-medium text-zinc-900"
          >
            ¿Por qué se devuelve?
          </label>
          <textarea
            id={`devolver-motivo-${ordenId}`}
            name="motivo"
            rows={3}
            maxLength={MOTIVO_MAXIMO}
            defaultValue={estado.ok ? "" : estado.valores.motivo}
            aria-invalid={Boolean(estado.errores.motivo)}
            placeholder="Por ejemplo: el corte salió con la manga más corta que la ficha"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:ring-2 focus:ring-stone-500 focus:outline-none"
          />
          {estado.errores.motivo ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {estado.errores.motivo[0]}
            </p>
          ) : null}
        </div>

        {destino ? (
          <p
            data-testid="resumen-devolucion"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-950"
          >
            Quedan devueltas {lista(seAnulan)}. No se borran: se ven en el
            historial con este motivo.{" "}
            {siguiente
              ? `Ahora le toca a ${ETIQUETAS_ROL[buscarCheckpoint(siguiente).rolDueno]}: «${buscarCheckpoint(siguiente).etiqueta}».`
              : ""}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={devolviendo || destino === ""}
          className="min-h-14 w-full rounded-lg bg-amber-700 px-6 text-lg font-semibold text-white hover:bg-amber-800 disabled:bg-zinc-400 sm:w-auto"
        >
          {devolviendo
            ? "Devolviendo…"
            : destino
              ? `Devolver a «${buscarCheckpoint(destino).etiqueta}»`
              : "Devolver la orden"}
        </button>
      </form>
    </details>
  );
}
