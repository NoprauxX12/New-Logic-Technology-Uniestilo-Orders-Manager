"use client";

import { useState } from "react";

import { CampoTexto } from "@/components/ui/CampoTexto";
import type { EntradaPrenda } from "@/features/ordenes/formulario";
import {
  esTallaje,
  IDS_DE_TALLAJE,
  TALLAJE_OTRO,
  TALLAJES,
} from "@/lib/ordenes/tallas";

/**
 * Una prenda de la orden. Los campos usan siempre el mismo `name`: el navegador
 * los envía repetidos y `leerFormularioOrden` los vuelve a agrupar por posición.
 * Por eso el orden de las filas en pantalla es el orden de las prendas.
 *
 * Las tallas se eligen, no se escriben: primero el tallaje (superior u inferior,
 * de hombre o de dama) y luego cuántas prendas hay de cada talla. La cantidad de
 * la prenda es la suma y se muestra sola. Con "Otro" quedan los campos de
 * siempre, para lo que no cabe en un tallaje.
 *
 * `cantidad` y `tallas` se mandan en todas las filas, también cuando no se
 * escriben, para que los campos repetidos sigan alineados por posición. Con un
 * tallaje van ocultos y el servidor los vuelve a calcular: lo que cuenta es la
 * cuadrícula, no estos dos.
 */

const SIN_ELEGIR = "";

/** Lo que se ve en el selector. El valor es el que guarda `item_orden.tallaje`. */
const OPCIONES = [
  ...IDS_DE_TALLAJE.map((id) => ({ id, etiqueta: TALLAJES[id].etiqueta })),
  { id: TALLAJE_OTRO, etiqueta: "Otro (escribir las tallas)" },
];

/** Suma de lo escrito en la cuadrícula; lo vacío o ilegible cuenta cero. */
function totalEscrito(
  tallas: readonly string[],
  cantidades: Readonly<Record<string, string>>,
): number {
  return tallas.reduce((total, talla) => {
    const numero = Number((cantidades[talla] ?? "").trim());
    return Number.isInteger(numero) && numero > 0 ? total + numero : total;
  }, 0);
}

type Props = {
  /** Posición dentro de la orden, para numerar la fila y ubicar sus errores. */
  posicion: number;
  /** Errores de toda la orden; aquí se filtran los de esta prenda. */
  errores: Record<string, string[]>;
  /** Lo que se escribió en esta prenda, para no perderlo si hubo error. */
  valores?: EntradaPrenda;
  /** Sin esto no se puede quitar la única prenda que queda. */
  sePuedeQuitar: boolean;
  alQuitar: () => void;
};

export function FilaPrenda({
  posicion,
  errores,
  valores,
  sePuedeQuitar,
  alQuitar,
}: Props) {
  const errorDe = (campo: string) => errores[`items.${posicion}.${campo}`];

  // El `name` se repite en todas las filas (así se agrupan las prendas), pero el
  // `id` no puede: es lo que une la etiqueta con su campo dentro de la página.
  const idDe = (campo: string) => `items-${posicion}-${campo}`;

  const [tallaje, setTallaje] = useState(valores?.tallaje ?? SIN_ELEGIR);
  const [cantidades, setCantidades] = useState<Record<string, string>>(
    valores?.cantidadesPorTalla ?? {},
  );

  const delCatalogo = esTallaje(tallaje) ? TALLAJES[tallaje] : null;
  const total = delCatalogo ? totalEscrito(delCatalogo.tallas, cantidades) : 0;
  const errorDeTallaje = errorDe("tallaje")?.[0];
  const errorDeTallas = errorDe("tallas")?.[0];
  const escribeATeclado = tallaje === TALLAJE_OTRO;

  return (
    <fieldset className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <legend className="px-1 text-base font-semibold text-zinc-900">
        Prenda {posicion + 1}
      </legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CampoTexto
            nombre="descripcion"
            identificador={idDe("descripcion")}
            etiqueta="¿Qué prenda es?"
            marcador="Camisas ejecutivas blancas manga larga"
            errores={errorDe("descripcion")}
            valorInicial={valores?.descripcion}
          />
        </div>

        <CampoTexto
          nombre="valor"
          identificador={idDe("valor")}
          etiqueta="Valor"
          ayuda="En pesos, sin puntos"
          numerico
          marcador="18500000"
          errores={errorDe("valor")}
          valorInicial={valores?.valor}
        />

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label
            htmlFor={idDe("tallaje")}
            className="text-base font-medium text-zinc-900"
          >
            ¿Para qué tipo de prenda son las tallas?
          </label>
          <select
            id={idDe("tallaje")}
            name="tallaje"
            value={tallaje}
            onChange={(evento) => setTallaje(evento.target.value)}
            aria-invalid={Boolean(errorDeTallaje)}
            className={[
              "min-h-12 w-full rounded-lg border bg-white px-3 text-base text-zinc-900",
              "focus:ring-2 focus:ring-stone-500 focus:outline-none",
              errorDeTallaje ? "border-red-600" : "border-zinc-300",
            ].join(" ")}
          >
            <option value={SIN_ELEGIR}>Elige una opción</option>
            {OPCIONES.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
          {errorDeTallaje ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {errorDeTallaje}
            </p>
          ) : null}
        </div>

        {delCatalogo ? (
          <div className="sm:col-span-2">
            <p className="text-base font-medium text-zinc-900">
              Cuántas prendas de cada talla
            </p>
            <p className="text-sm text-zinc-600">
              Deja en blanco las tallas que no lleva
            </p>

            <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {delCatalogo.tallas.map((talla) => (
                <div key={talla} className="flex flex-col gap-1">
                  <label
                    htmlFor={idDe(`talla-${talla}`)}
                    className="text-center text-base font-semibold text-zinc-900"
                  >
                    {talla}
                  </label>
                  <input
                    id={idDe(`talla-${talla}`)}
                    name={`talla.${posicion}.${talla}`}
                    inputMode="numeric"
                    value={cantidades[talla] ?? ""}
                    onChange={(evento) =>
                      setCantidades((actuales) => ({
                        ...actuales,
                        [talla]: evento.target.value,
                      }))
                    }
                    className="min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-2 text-center text-lg text-zinc-900 focus:ring-2 focus:ring-stone-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <p
              role="status"
              className="mt-3 text-lg font-semibold text-zinc-900"
            >
              Total: {total} {total === 1 ? "prenda" : "prendas"}
            </p>

            {errorDeTallas ? (
              <p role="alert" className="text-sm font-medium text-red-700">
                {errorDeTallas}
              </p>
            ) : null}

            <input type="hidden" name="cantidad" value={total} />
            <input type="hidden" name="tallas" value="" />
          </div>
        ) : null}

        {escribeATeclado ? (
          <>
            <CampoTexto
              nombre="cantidad"
              identificador={idDe("cantidad")}
              etiqueta="Cantidad"
              ayuda="Cuántas unidades en total"
              numerico
              marcador="240"
              errores={errorDe("cantidad")}
              valorInicial={valores?.cantidad}
            />

            <CampoTexto
              nombre="tallas"
              identificador={idDe("tallas")}
              etiqueta="Tallas"
              ayuda="Cuántas de cada talla"
              marcador="S:60, M:100, L:80"
              errores={errorDe("tallas")}
              valorInicial={valores?.tallas}
            />
          </>
        ) : null}

        {!delCatalogo && !escribeATeclado ? (
          <>
            <input type="hidden" name="cantidad" value="" />
            <input type="hidden" name="tallas" value="" />
          </>
        ) : null}

        <div className="sm:col-span-2">
          <CampoTexto
            nombre="observacionesItem"
            identificador={idDe("observacionesItem")}
            etiqueta="Observaciones de la prenda (opcional)"
            errores={errorDe("observaciones")}
            valorInicial={valores?.observaciones}
          />
        </div>
      </div>

      {sePuedeQuitar ? (
        <button
          type="button"
          onClick={alQuitar}
          className="mt-4 min-h-11 rounded-lg px-3 text-base font-medium text-red-700 underline underline-offset-2 hover:bg-red-50"
        >
          Quitar esta prenda
        </button>
      ) : null}
    </fieldset>
  );
}
