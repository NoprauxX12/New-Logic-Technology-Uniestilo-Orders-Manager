"use client";

import { useActionState, useState } from "react";

import {
  crearOrdenDeCorreccion,
  type EstadoCorreccion,
} from "@/features/correcciones/actions";
import type { OrdenParaCorreccion } from "@/features/correcciones/queries";
import {
  ETAPA_DE_ENTRADA_POR_DEFECTO,
  ETAPAS_DE_ENTRADA,
  MOTIVO_MAXIMO,
  numeroDeCorreccion,
} from "@/features/correcciones/reglas";
import { buscarCheckpoint } from "@/features/workflow/checkpoints";

/**
 * HU-18 · "Crear orden de corrección" sobre una orden ya cerrada (solo
 * administración).
 *
 * Se eligen las prendas defectuosas de la orden original, cuántas son y de qué
 * tallas (en texto, porque lo defectuoso rara vez coincide con la cuadrícula de
 * tallas de la orden), por qué etapa entra la corrección (por defecto el corte)
 * y para cuándo. La orden nueva queda enlazada a la original y sale con valor
 * 0: es trabajo repetido sobre prendas que ya se cobraron.
 */

const ESTADO_INICIAL: EstadoCorreccion = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: {
    ordenOriginalId: "",
    fechaEntrega: "",
    motivo: "",
    etapaInicial: ETAPA_DE_ENTRADA_POR_DEFECTO,
    items: [],
  },
};

type Props = {
  orden: Pick<
    OrdenParaCorreccion,
    | "id"
    | "numeroOrdenCompra"
    | "prendas"
    | "correccionesCreadas"
    | "numerosOcupados"
  >;
  /** Hoy en Colombia (`AAAA-MM-DD`): la fecha de entrega no puede ser anterior. */
  hoy: string;
};

function ErrorDeCampo({ mensajes }: { mensajes?: string[] }) {
  if (!mensajes?.length) return null;
  return (
    <p role="alert" className="text-sm font-medium text-red-700">
      {mensajes[0]}
    </p>
  );
}

const CLASE_CAMPO =
  "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus:ring-2 focus:ring-stone-500 focus:outline-none";

export function FormularioOrdenCorreccion({ orden, hoy }: Props) {
  const [estado, crear, creando] = useActionState(
    crearOrdenDeCorreccion,
    ESTADO_INICIAL,
  );
  const escrito = estado.valores;
  const [incluidas, setIncluidas] = useState<Set<string>>(
    () => new Set(escrito.items.map((prenda) => prenda.itemId)),
  );

  const numeroNuevo = numeroDeCorreccion(
    orden.numeroOrdenCompra,
    orden.correccionesCreadas,
    orden.numerosOcupados,
  );

  function alternar(itemId: string) {
    setIncluidas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(itemId)) siguientes.delete(itemId);
      else siguientes.add(itemId);
      return siguientes;
    });
  }

  return (
    <details
      className="rounded-xl border border-zinc-200 bg-white p-4"
      open={Boolean(estado.mensaje)}
    >
      <summary className="flex min-h-12 cursor-pointer items-center text-lg font-semibold text-zinc-900">
        Crear orden de corrección
      </summary>

      <form action={crear} className="mt-4 flex flex-col gap-5">
        <input type="hidden" name="ordenOriginalId" value={orden.id} />

        <p className="text-base text-zinc-700">
          Esta orden ya está cerrada, así que no se toca. Se crea una orden
          nueva, <strong>{numeroNuevo}</strong>, enlazada a esta, solo con las
          prendas que salieron mal.
        </p>

        {estado.mensaje ? (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
          >
            {estado.mensaje}
          </p>
        ) : null}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-base font-medium text-zinc-900">
            ¿Qué prendas salieron mal?
          </legend>

          {orden.prendas.map((prenda) => {
            const marcada = incluidas.has(prenda.id);
            const enviada = escrito.items.find(
              (item) => item.itemId === prenda.id,
            );
            const errores = {
              cantidad: estado.errores[`cantidad.${prenda.id}`],
              tallas: estado.errores[`tallas.${prenda.id}`],
            };

            return (
              <div
                key={prenda.id}
                className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3"
              >
                <label className="flex min-h-12 items-center gap-3 text-base font-medium text-zinc-900">
                  <input
                    type="checkbox"
                    name="incluir"
                    value={prenda.id}
                    checked={marcada}
                    onChange={() => alternar(prenda.id)}
                    className="size-6"
                  />
                  <span>
                    {prenda.descripcion}{" "}
                    <span className="font-normal text-zinc-600">
                      (la orden tenía {prenda.cantidad})
                    </span>
                  </span>
                </label>

                {marcada ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`cantidad-${prenda.id}`}
                        className="text-base font-medium text-zinc-900"
                      >
                        ¿Cuántas salieron mal?
                      </label>
                      <input
                        id={`cantidad-${prenda.id}`}
                        name={`cantidad.${prenda.id}`}
                        inputMode="numeric"
                        defaultValue={enviada?.cantidad ?? ""}
                        aria-invalid={Boolean(errores.cantidad)}
                        className={CLASE_CAMPO}
                      />
                      <ErrorDeCampo mensajes={errores.cantidad} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`tallas-${prenda.id}`}
                        className="text-base font-medium text-zinc-900"
                      >
                        ¿De qué tallas?
                      </label>
                      <input
                        id={`tallas-${prenda.id}`}
                        name={`tallas.${prenda.id}`}
                        defaultValue={enviada?.tallas ?? ""}
                        placeholder="S:8, M:4"
                        aria-invalid={Boolean(errores.tallas)}
                        className={CLASE_CAMPO}
                      />
                      <ErrorDeCampo mensajes={errores.tallas} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          <ErrorDeCampo mensajes={estado.errores.items} />
        </fieldset>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="correccion-motivo"
            className="text-base font-medium text-zinc-900"
          >
            ¿Qué defecto tienen?
          </label>
          <textarea
            id="correccion-motivo"
            name="motivo"
            rows={3}
            maxLength={MOTIVO_MAXIMO}
            defaultValue={escrito.motivo}
            aria-invalid={Boolean(estado.errores.motivo)}
            placeholder="Por ejemplo: la costura del cuello llegó abierta"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:ring-2 focus:ring-stone-500 focus:outline-none"
          />
          <ErrorDeCampo mensajes={estado.errores.motivo} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="correccion-entrega"
              className="text-base font-medium text-zinc-900"
            >
              ¿Para cuándo se entrega?
            </label>
            <input
              id="correccion-entrega"
              name="fechaEntrega"
              type="date"
              min={hoy}
              defaultValue={escrito.fechaEntrega}
              aria-invalid={Boolean(estado.errores.fechaEntrega)}
              className={CLASE_CAMPO}
            />
            <ErrorDeCampo mensajes={estado.errores.fechaEntrega} />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="correccion-etapa"
              className="text-base font-medium text-zinc-900"
            >
              ¿Por qué etapa entra?
            </label>
            <select
              id="correccion-etapa"
              name="etapaInicial"
              defaultValue={escrito.etapaInicial}
              className={CLASE_CAMPO}
            >
              {ETAPAS_DE_ENTRADA.map((id) => (
                <option key={id} value={id}>
                  {buscarCheckpoint(id).etiqueta}
                </option>
              ))}
            </select>
            <p className="text-sm text-zinc-600">
              Las etapas anteriores se verán como «No aplicó».
            </p>
            <ErrorDeCampo mensajes={estado.errores.etapaInicial} />
          </div>
        </div>

        <button
          type="submit"
          disabled={creando}
          className="min-h-14 w-full rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400 sm:w-auto"
        >
          {creando ? "Creando…" : `Crear ${numeroNuevo}`}
        </button>
      </form>
    </details>
  );
}
