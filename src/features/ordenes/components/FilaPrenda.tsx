import { CampoTexto } from "@/features/ordenes/components/CampoTexto";
import type { EntradaPrenda } from "@/features/ordenes/formulario";

/**
 * Una prenda de la orden. Los campos usan siempre el mismo `name`: el navegador
 * los envía repetidos y `leerFormularioOrden` los vuelve a agrupar por posición.
 * Por eso el orden de las filas en pantalla es el orden de las prendas.
 */

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

  return (
    <fieldset className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <legend className="px-1 text-base font-semibold text-zinc-900">
        Prenda {posicion + 1}
      </legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CampoTexto
            nombre="descripcion"
            etiqueta="¿Qué prenda es?"
            marcador="Camisas ejecutivas blancas manga larga"
            errores={errorDe("descripcion")}
            valorInicial={valores?.descripcion}
          />
        </div>

        <CampoTexto
          nombre="cantidad"
          etiqueta="Cantidad"
          ayuda="Cuántas unidades en total"
          numerico
          marcador="240"
          errores={errorDe("cantidad")}
          valorInicial={valores?.cantidad}
        />

        <CampoTexto
          nombre="valor"
          etiqueta="Valor"
          ayuda="En pesos, sin puntos"
          numerico
          marcador="18500000"
          errores={errorDe("valor")}
          valorInicial={valores?.valor}
        />

        <div className="sm:col-span-2">
          <CampoTexto
            nombre="tallas"
            etiqueta="Tallas"
            ayuda="Cuántas de cada talla"
            marcador="S:60, M:100, L:80"
            errores={errorDe("tallas")}
            valorInicial={valores?.tallas}
          />
        </div>

        <div className="sm:col-span-2">
          <CampoTexto
            nombre="observacionesItem"
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
