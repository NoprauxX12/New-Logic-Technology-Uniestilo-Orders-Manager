"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { CampoTexto } from "@/components/ui/CampoTexto";
import type { EstadoFormularioOrden } from "@/features/ordenes/actions";
import { FilaPrenda } from "@/features/ordenes/components/FilaPrenda";
import {
  ENTRADA_VACIA,
  type EntradaFormularioOrden,
} from "@/features/ordenes/formulario";

/**
 * Los campos de una orden (HU-01): los mismos al registrarla y al editarla.
 * `FormularioNuevaOrden` y `FormularioEditarOrden` solo dicen qué action usar.
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

type Props = {
  accion: (
    estado: EstadoFormularioOrden,
    formData: FormData,
  ) => Promise<EstadoFormularioOrden>;
  /** Al editar: lo guardado. Al registrar, el formulario arranca en blanco. */
  valoresIniciales?: EntradaFormularioOrden;
  /** Al editar: cuál orden es. */
  ordenId?: string;
  textoGuardar: string;
  /** Lo que se agrega al mensaje de éxito, si la pantalla sigue abierta. */
  textoTrasGuardar?: string;
  /** Lo que se le explica a la persona sobre los datos del cliente. */
  ayudaCliente: string;
};

/** Cada fila con una clave propia, para reconocerla al volver de la action. */
function conClaves(entrada: EntradaFormularioOrden): EntradaFormularioOrden {
  return {
    ...entrada,
    items: entrada.items.map((prenda, posicion) => ({
      ...prenda,
      clave: `fila-${posicion}`,
    })),
  };
}

export function FormularioOrden({
  accion,
  valoresIniciales = ENTRADA_VACIA,
  ordenId,
  textoGuardar,
  textoTrasGuardar,
  ayudaCliente,
}: Props) {
  const [inicial] = useState(() => conClaves(valoresIniciales));

  const [estado, enviar, enviando] = useActionState(accion, {
    ok: false,
    mensaje: "",
    errores: {},
    valores: inicial,
  });

  // Una clave por fila: sirve de `key` y sobrevive a quitar filas del medio,
  // cosa que el índice no haría. El `itemId` va con la fila por lo mismo.
  const siguienteId = useRef(inicial.items.length + 1);
  const [filas, setFilas] = useState<{ clave: string; itemId?: string }[]>(
    () =>
      inicial.items.length > 0
        ? inicial.items.map((prenda) => ({
            clave: prenda.clave ?? "",
            itemId: prenda.itemId,
          }))
        : [{ clave: "fila-0" }],
  );

  // Guardada la orden, se vuelve a una sola prenda en blanco para la siguiente.
  // Los campos los limpia React con los `defaultValue` vacíos que llegan en
  // `estado.valores`.
  useEffect(() => {
    if (!estado.ok) return;
    setFilas([{ clave: `fila-${siguienteId.current++}` }]);
  }, [estado]);

  function agregarPrenda() {
    setFilas((actuales) => [
      ...actuales,
      { clave: `fila-${siguienteId.current++}` },
    ]);
  }

  function quitarPrenda(clave: string) {
    setFilas((actuales) => actuales.filter((fila) => fila.clave !== clave));
  }

  return (
    <form action={enviar} className="flex flex-col gap-8">
      {ordenId ? <input type="hidden" name="ordenId" value={ordenId} /> : null}

      {estado.ok ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
        >
          {estado.mensaje} {textoTrasGuardar}
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
        <p className="text-sm text-zinc-600">{ayudaCliente}</p>

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

        {filas.map((fila, posicion) => (
          <FilaPrenda
            key={fila.clave}
            posicion={posicion}
            clave={fila.clave}
            itemId={fila.itemId}
            errores={estado.errores}
            valores={estado.valores.items.find(
              (prenda) => prenda.clave === fila.clave,
            )}
            sePuedeQuitar={filas.length > 1}
            alQuitar={() => quitarPrenda(fila.clave)}
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
        {enviando ? "Guardando…" : textoGuardar}
      </button>
    </form>
  );
}
