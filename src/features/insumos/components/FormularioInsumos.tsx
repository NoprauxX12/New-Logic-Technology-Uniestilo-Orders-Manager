"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import {
  INSUMOS,
  MAXIMO_DETALLE,
  type TipoInsumo,
} from "@/features/insumos/catalogo";
import { validarInsumos } from "@/features/insumos/actions";

/**
 * HU-23 · Las casillas de los siete insumos y un solo botón (RNF-08).
 *
 * Secretaría marca lo que lleva la orden y, al marcarlo, escribe cuánto y cómo
 * («200 botones blancos de 4 huecos»). El botón guarda el listado y marca la
 * etapa a la vez: no hay borrador que se quede a medias.
 */

type Props = {
  ordenId: string;
  /** El aviso de éxito sube a la lista: al validar, la tarjeta cambia de grupo. */
  alValidar: (mensaje: string) => void;
};

export function FormularioInsumos({ ordenId, alValidar }: Props) {
  const [marcados, setMarcados] = useState<ReadonlySet<TipoInsumo>>(
    () => new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();
  const idAyuda = useId();

  function alternar(insumo: TipoInsumo) {
    setMarcados((anteriores) => {
      const siguientes = new Set(anteriores);
      if (siguientes.has(insumo)) siguientes.delete(insumo);
      else siguientes.add(insumo);
      return siguientes;
    });
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setError(null);

    iniciarTransicion(async () => {
      const resultado = await validarInsumos({ ok: false, mensaje: "" }, datos);
      if (resultado.ok) {
        alValidar(resultado.mensaje);
        return;
      }
      setError(resultado.mensaje);
    });
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="ordenId" value={ordenId} />

      <fieldset disabled={pendiente} className="min-w-0">
        <legend className="text-base font-semibold text-zinc-900">
          ¿Qué insumos lleva la orden?
        </legend>
        <p id={idAyuda} className="mt-1 text-sm text-zinc-600">
          Marca cada insumo y escribe cuánto y cómo, según la orden de compra.
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {INSUMOS.map((insumo) => {
            const marcado = marcados.has(insumo.id);
            return (
              <li
                key={insumo.id}
                className={[
                  "rounded-lg border px-3 py-2",
                  marcado
                    ? "border-stone-500 bg-stone-50"
                    : "border-zinc-200 bg-white",
                ].join(" ")}
              >
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-medium text-zinc-900">
                  <input
                    type="checkbox"
                    name="insumo"
                    value={insumo.id}
                    checked={marcado}
                    onChange={() => alternar(insumo.id)}
                    aria-describedby={idAyuda}
                    className="h-6 w-6 accent-stone-700"
                  />
                  {insumo.etiqueta}
                </label>

                {marcado ? (
                  <label className="mt-1 mb-1 block space-y-1">
                    <span className="text-sm text-zinc-700">
                      Cuánto y cómo: {insumo.etiqueta.toLowerCase()}
                    </span>
                    <input
                      name={`detalle.${insumo.id}`}
                      required
                      maxLength={MAXIMO_DETALLE}
                      placeholder={`Ejemplo: ${insumo.ejemplo}`}
                      autoComplete="off"
                      className="min-h-12 w-full rounded-lg border border-zinc-400 bg-white px-3 text-base"
                    />
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      </fieldset>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente || marcados.size === 0}
        className="min-h-12 self-start rounded-lg bg-stone-700 px-5 font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {pendiente ? "Guardando…" : "Marcar insumos validados"}
      </button>
    </form>
  );
}
