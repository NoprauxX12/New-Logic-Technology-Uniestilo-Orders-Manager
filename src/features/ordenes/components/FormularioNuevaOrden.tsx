"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { CampoTexto } from "@/components/ui/CampoTexto";
import {
  registrarOrden,
  type EstadoFormularioOrden,
} from "@/features/ordenes/actions";
import { FilaPrenda } from "@/features/ordenes/components/FilaPrenda";
import { ENTRADA_VACIA } from "@/features/ordenes/formulario";

/**
 * HU-01 · Formulario de registro de una nueva orden.
 *
 * Es un componente de cliente porque necesita estado: agregar y quitar prendas,
 * y mostrar los errores que devuelve la action.
 *
 * No usa el atributo `required` del navegador a propósito. Toda la validación
 * sale del mismo lugar —el esquema de zod—, para que los mensajes estén en el
 * lenguaje del taller y no mezclados con los del navegador.
 *
 * Los campos van con `defaultValue` tomado de `estado.valores`: React 19 limpia
 * el formulario al terminar la action, así que sin eso un error de validación
 * borraría todo lo escrito.
 */

const ESTADO_INICIAL: EstadoFormularioOrden = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: ENTRADA_VACIA,
};

export function FormularioNuevaOrden() {
  const [estado, enviar, enviando] = useActionState(
    registrarOrden,
    ESTADO_INICIAL,
  );

  // Un id por fila de prenda: sirve de `key` y sobrevive a quitar filas
  // del medio, cosa que el índice no haría.
  const [prendas, setPrendas] = useState<number[]>([0]);
  const siguienteId = useRef(1);
  // Guardada la orden, se vuelve a una sola prenda en blanco para la siguiente.
  // Los campos los limpia React con los `defaultValue` vacíos que llegan en
  // `estado.valores`.
  useEffect(() => {
    if (!estado.ok) return;
    setPrendas([siguienteId.current++]);
  }, [estado]);

  function agregarPrenda() {
    setPrendas((actuales) => [...actuales, siguienteId.current++]);
  }

  function quitarPrenda(id: number) {
    setPrendas((actuales) => actuales.filter((otro) => otro !== id));
  }

  return (
    <form action={enviar} className="flex flex-col gap-8">
      {estado.ok ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
        >
          {estado.mensaje} Ya puedes registrar la siguiente.
        </p>
      ) : null}

      {estado.mensaje && !estado.ok ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
        >
          {estado.mensaje}
        </p>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">
          Datos del pedido
        </h2>

        <CampoTexto
          nombre="numeroOrdenCompra"
          etiqueta="Número de orden de compra"
          ayuda="El que trae el documento del cliente"
          marcador="OC-4412"
          errores={estado.errores.numeroOrdenCompra}
          valorInicial={estado.valores.numeroOrdenCompra}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nombre="fechaIngreso"
            etiqueta="Fecha en que entró el pedido"
            tipo="date"
            errores={estado.errores.fechaIngreso}
            valorInicial={estado.valores.fechaIngreso}
          />
          <CampoTexto
            nombre="fechaEntrega"
            etiqueta="Fecha de entrega"
            tipo="date"
            errores={estado.errores.fechaEntrega}
            valorInicial={estado.valores.fechaEntrega}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">Cliente</h2>
        <p className="text-sm text-zinc-600">
          Si el NIT ya está registrado, se usa el cliente que ya existe.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nombre="nit"
            etiqueta="NIT"
            marcador="900.123.456-7"
            errores={estado.errores.nit}
            valorInicial={estado.valores.nit}
          />
          <CampoTexto
            nombre="razonSocial"
            etiqueta="Razón social"
            marcador="Universidad EAFIT"
            errores={estado.errores.razonSocial}
            valorInicial={estado.valores.razonSocial}
          />
          <CampoTexto
            nombre="contactoNombre"
            etiqueta="Persona de contacto"
            errores={estado.errores.contactoNombre}
            valorInicial={estado.valores.contactoNombre}
          />
          <CampoTexto
            nombre="contactoCelular"
            etiqueta="Celular"
            numerico
            marcador="300 123 4567"
            errores={estado.errores.contactoCelular}
            valorInicial={estado.valores.contactoCelular}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">Prendas</h2>

        {estado.errores.items ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {estado.errores.items[0]}
          </p>
        ) : null}

        {prendas.map((id, posicion) => (
          <FilaPrenda
            key={id}
            posicion={posicion}
            errores={estado.errores}
            valores={estado.valores.items[posicion]}
            sePuedeQuitar={prendas.length > 1}
            alQuitar={() => quitarPrenda(id)}
          />
        ))}

        <button
          type="button"
          onClick={agregarPrenda}
          className="min-h-12 self-start rounded-lg border border-zinc-400 px-4 text-base font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Agregar otra prenda
        </button>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-zinc-900">Observaciones</h2>
        <CampoTexto
          nombre="observaciones"
          etiqueta="Observaciones de la orden (opcional)"
          ayuda="Cualquier cosa que el taller deba tener en cuenta"
          errores={estado.errores.observaciones}
          valorInicial={estado.valores.observaciones}
        />
      </section>

      <button
        type="submit"
        disabled={enviando}
        className="min-h-14 rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Guardando…" : "Guardar orden"}
      </button>
    </form>
  );
}
