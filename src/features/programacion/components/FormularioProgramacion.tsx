"use client";

import { useActionState, useState } from "react";

import {
  ESTADO_INICIAL,
  programarOrdenes,
} from "@/features/programacion/actions";
import type { OrdenPorProgramar } from "@/features/programacion/queries";
import { MAXIMO_POR_HOJA, moverEnLista } from "@/features/programacion/reglas";
import { formatearFecha } from "@/lib/utils/fechas";

/**
 * HU-03 · Armar la hoja de programación.
 *
 * La secretaria toca las órdenes que van en la hoja y después las acomoda con
 * las flechas, que mueven una orden un puesto arriba o abajo. Nada de arrastrar
 * ni de escribir turnos: un toque por movimiento, botones grandes y todo
 * funciona con el dedo y con teclado (RNF-08/09/10).
 *
 * El turno no lo escribe nadie: es la posición en la lista. Y el número de la
 * hoja lo asigna el sistema al guardar.
 *
 * Los `ordenId` viajan en campos ocultos en el orden de la lista, y el
 * navegador los manda en ese mismo orden; así `leerFormularioProgramacion`
 * reconstruye la secuencia sin numerarla a mano.
 */

type Props = {
  ordenes: OrdenPorProgramar[];
};

export function FormularioProgramacion({ ordenes }: Props) {
  const [estado, accion, pendiente] = useActionState(
    programarOrdenes,
    ESTADO_INICIAL,
  );

  /** Los ids en el orden en que deben trabajarse. */
  const [hoja, setHoja] = useState<string[]>([]);

  const porId = new Map(ordenes.map((orden) => [orden.id, orden]));
  const agregadas = hoja.flatMap((id) => {
    const orden = porId.get(id);
    return orden ? [orden] : [];
  });

  const llena = hoja.length >= MAXIMO_POR_HOJA;

  function alternar(ordenId: string) {
    setHoja((actual) =>
      actual.includes(ordenId)
        ? actual.filter((id) => id !== ordenId)
        : [...actual, ordenId],
    );
  }

  function mover(posicion: number, direccion: "arriba" | "abajo") {
    setHoja((actual) => moverEnLista(actual, posicion, direccion));
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
          Las más antiguas primero. Toca las que van en esta programación.
        </p>

        <ul className="flex flex-col gap-3">
          {ordenes.map((orden) => {
            const agregada = hoja.includes(orden.id);

            return (
              <li key={orden.id}>
                <button
                  type="button"
                  onClick={() => alternar(orden.id)}
                  aria-pressed={agregada}
                  disabled={!agregada && llena}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl border p-4 text-left",
                    agregada
                      ? "border-stone-700 bg-stone-50"
                      : "border-zinc-200 bg-white hover:bg-zinc-50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={[
                      "flex size-9 flex-none items-center justify-center rounded-full text-xl",
                      agregada
                        ? "bg-stone-700 text-white"
                        : "border border-zinc-300 text-zinc-400",
                    ].join(" ")}
                  >
                    {agregada ? "✓" : "+"}
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
                        ? "Está en la programación. Toca para quitarla."
                        : "Toca para agregarla a la programación."}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-zinc-100 p-5 lg:w-96">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            Esta programación
          </h2>
          <p className="text-sm text-zinc-600">
            {agregadas.length} de {MAXIMO_POR_HOJA}
          </p>
        </div>

        {agregadas.length === 0 ? (
          <p className="text-sm text-zinc-700">
            Todavía no has agregado ninguna orden. Toca las de la izquierda y
            después acomódalas con las flechas.
          </p>
        ) : (
          <>
            <p className="text-sm text-zinc-700">
              Diseño las va a ver en este orden. Usa las flechas para
              acomodarlas.
            </p>

            <ol className="flex flex-col gap-2">
              {agregadas.map((orden, indice) => {
                const errores = estado.errores[orden.id];

                return (
                  <li
                    key={orden.id}
                    className={[
                      "flex items-center gap-2 rounded-lg border bg-white p-2",
                      errores?.length ? "border-red-600" : "border-zinc-200",
                    ].join(" ")}
                  >
                    <input type="hidden" name="ordenId" value={orden.id} />

                    <span
                      aria-hidden
                      className="flex size-8 flex-none items-center justify-center rounded-full bg-stone-700 text-sm font-semibold text-white"
                    >
                      {indice + 1}
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-zinc-900">
                        {orden.razonSocial}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {orden.numeroOrdenCompra} · {orden.totalPrendas} prendas
                      </span>
                      {errores?.length ? (
                        <span
                          role="alert"
                          className="text-xs font-medium text-red-700"
                        >
                          {errores[0]}
                        </span>
                      ) : null}
                    </span>

                    <span className="flex flex-none gap-1">
                      <button
                        type="button"
                        onClick={() => mover(indice, "arriba")}
                        disabled={indice === 0}
                        aria-label={`Subir ${orden.razonSocial}`}
                        className="size-11 rounded-lg border border-zinc-300 bg-white text-lg text-zinc-800 hover:bg-zinc-50 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => mover(indice, "abajo")}
                        disabled={indice === agregadas.length - 1}
                        aria-label={`Bajar ${orden.razonSocial}`}
                        className="size-11 rounded-lg border border-zinc-300 bg-white text-lg text-zinc-800 hover:bg-zinc-50 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => alternar(orden.id)}
                        aria-label={`Quitar ${orden.razonSocial} de la programación`}
                        className="size-11 rounded-lg border border-zinc-300 bg-white text-lg text-zinc-800 hover:bg-zinc-50"
                      >
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {llena ? (
          <p className="text-sm text-zinc-700">
            Llegaste al tope de {MAXIMO_POR_HOJA}. Guarda esta y sigue con otra.
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
