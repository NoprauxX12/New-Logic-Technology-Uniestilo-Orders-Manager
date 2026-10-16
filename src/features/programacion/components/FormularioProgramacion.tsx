"use client";

import { useActionState, useState } from "react";

import {
  ESTADO_INICIAL,
  programarOrdenes,
} from "@/features/programacion/actions";
import type { OrdenPorProgramar } from "@/features/programacion/queries";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-03 · Armar la hoja de programación.
 *
 * La secretaria toca las órdenes en el orden en que deben trabajarse y la
 * posición es el orden en que las toca: la primera queda en 1, la segunda en 2.
 * No hay que arrastrar nada ni escribir números de posición (RNF-08/09/10).
 *
 * No hay tope: agrega las que haga falta, y lo que no entre hoy lo programa en
 * otra ronda, que quedará después de esta.
 *
 * Los `ordenId` van en campos ocultos en el orden de la lista, y el navegador
 * los manda en ese mismo orden; así `leerFormularioProgramacion` reconstruye la
 * secuencia sin que la pantalla tenga que numerarla a mano.
 */

type Props = {
  ordenes: OrdenPorProgramar[];
};

export function FormularioProgramacion({ ordenes }: Props) {
  const [estado, accion, pendiente] = useActionState(
    programarOrdenes,
    ESTADO_INICIAL,
  );

  /** Los ids en el orden en que se tocaron: eso es el orden de trabajo. */
  const [seleccion, setSeleccion] = useState<string[]>([]);

  const porId = new Map(ordenes.map((orden) => [orden.id, orden]));
  const agregadas = seleccion.flatMap((id) => {
    const orden = porId.get(id);
    return orden ? [orden] : [];
  });

  function alternar(ordenId: string) {
    setSeleccion((actual) =>
      actual.includes(ordenId)
        ? actual.filter((id) => id !== ordenId)
        : [...actual, ordenId],
    );
  }

  if (ordenes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center">
        <p className="font-medium text-zinc-900">
          No hay órdenes esperando programación
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          Cuando administración registre una orden, aparecerá en esta lista.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="flex flex-col gap-6 lg:flex-row">
      <section className="flex flex-1 flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">
          Órdenes sin programar
        </h2>
        <p className="text-sm text-zinc-600">
          Las más antiguas primero. Tócalas en el orden en que deben trabajarse.
        </p>

        <ul className="flex flex-col gap-3">
          {ordenes.map((orden) => {
            const posicion = seleccion.indexOf(orden.id);
            const agregada = posicion >= 0;

            return (
              <li key={orden.id}>
                <button
                  type="button"
                  onClick={() => alternar(orden.id)}
                  aria-pressed={agregada}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl border p-4 text-left",
                    agregada
                      ? "border-stone-700 bg-stone-50"
                      : "border-zinc-200 bg-white hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={[
                      "flex size-9 flex-none items-center justify-center rounded-full text-base font-semibold",
                      agregada
                        ? "bg-stone-700 text-white"
                        : "border border-zinc-300 text-transparent",
                    ].join(" ")}
                  >
                    {agregada ? posicion + 1 : "0"}
                  </span>

                  <span className="flex flex-col gap-0.5">
                    <span className="text-base font-semibold text-zinc-900">
                      {orden.razonSocial}
                    </span>
                    <span className="text-sm text-zinc-600">
                      {orden.numeroOrdenCompra} · llegó el{" "}
                      {formatearFecha(orden.fechaIngreso)} ·{" "}
                      {orden.referencias.length}{" "}
                      {orden.referencias.length === 1
                        ? "referencia"
                        : "referencias"}{" "}
                      · {orden.totalPrendas} prendas
                    </span>
                    <span className="sr-only">
                      {agregada
                        ? `Agregada en la posición ${posicion + 1}. Toca para quitarla.`
                        : "Toca para agregarla a la programación."}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-zinc-100 p-5 lg:w-80">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Tu hoja</h2>
          <p className="text-sm text-zinc-600">
            {agregadas.length} {agregadas.length === 1 ? "orden" : "órdenes"}
          </p>
        </div>

        {agregadas.length === 0 ? (
          <p className="text-sm text-zinc-700">
            Todavía no has agregado ninguna orden. Toca las de la izquierda en
            el orden en que diseño debe trabajarlas.
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {agregadas.map((orden, indice) => {
              const errores = estado.errores[orden.id];
              const idCampo = `numero-${orden.id}`;
              const idError = `${idCampo}-error`;
              const escrito = estado.valores.programaciones.find(
                (fila) => fila.ordenId === orden.id,
              );

              return (
                <li key={orden.id} className="flex flex-col gap-1">
                  <input type="hidden" name="ordenId" value={orden.id} />

                  <label
                    htmlFor={idCampo}
                    className="text-sm font-medium text-zinc-900"
                  >
                    {indice + 1} · {orden.razonSocial}
                  </label>

                  <input
                    id={idCampo}
                    name="numeroOrdenProgramacion"
                    type="text"
                    defaultValue={escrito?.numeroOrdenProgramacion}
                    placeholder="# de programación"
                    aria-invalid={Boolean(errores?.length)}
                    aria-describedby={errores?.length ? idError : undefined}
                    className={[
                      "min-h-12 rounded-lg border bg-white px-3 text-base text-zinc-900",
                      "focus:ring-2 focus:ring-stone-500 focus:outline-none",
                      errores?.length ? "border-red-600" : "border-zinc-300",
                    ].join(" ")}
                  />

                  {errores?.length ? (
                    <p
                      id={idError}
                      role="alert"
                      className="text-sm font-medium text-red-700"
                    >
                      {errores[0]}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        {estado.errores.lista?.length ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {estado.errores.lista[0]}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pendiente || agregadas.length === 0}
          className="min-h-14 rounded-lg bg-stone-700 px-5 text-lg font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {pendiente ? "Guardando…" : "Programar a diseño"}
        </button>

        <p className="text-sm text-zinc-600">
          Quedará registrado con tu nombre y la hora.
        </p>

        {estado.mensaje ? (
          <p
            role={estado.ok ? "status" : "alert"}
            className={[
              "rounded-lg px-4 py-3 text-sm",
              estado.ok
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-800",
            ].join(" ")}
          >
            {estado.mensaje}
          </p>
        ) : null}
      </section>
    </form>
  );
}
