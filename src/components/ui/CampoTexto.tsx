/**
 * Campo de texto con su etiqueta y su error debajo.
 *
 * Pensado para gente poco digital (RNF-08/09/10): la etiqueta siempre visible,
 * el campo alto para poder tocarlo con el dedo, y el error en rojo justo abajo.
 */

type Props = {
  nombre: string;
  /**
   * `id` del campo en la página. Por defecto es el `nombre`, que alcanza cuando
   * el campo aparece una sola vez. Las prendas repiten el mismo `nombre` en cada
   * fila a propósito —así las agrupa `leerFormularioOrden`—, así que ahí hay que
   * darle uno propio: dos campos con el mismo `id` hacen que la etiqueta de la
   * Prenda 2 enfoque el campo de la Prenda 1.
   */
  identificador?: string;
  etiqueta: string;
  /** Texto de apoyo debajo de la etiqueta, con un ejemplo de lo que se espera. */
  ayuda?: string;
  tipo?: "text" | "date";
  /** Muestra el teclado numérico en el celular sin usar type="number". */
  numerico?: boolean;
  marcador?: string;
  errores?: string[];
  /**
   * Valor con el que arranca el campo. React 19 limpia el formulario al
   * terminar una action y lo devuelve a este valor, así que es también lo que
   * conserva lo escrito cuando la orden no se pudo guardar.
   */
  valorInicial?: string;
};

export function CampoTexto({
  nombre,
  identificador,
  etiqueta,
  ayuda,
  tipo = "text",
  numerico = false,
  marcador,
  errores,
  valorInicial,
}: Props) {
  const idCampo = identificador ?? nombre;
  const idError = `${idCampo}-error`;
  const idAyuda = `${idCampo}-ayuda`;
  const tieneError = Boolean(errores?.length);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idCampo} className="text-base font-medium text-zinc-900">
        {etiqueta}
      </label>

      {ayuda ? (
        <p id={idAyuda} className="text-sm text-zinc-600">
          {ayuda}
        </p>
      ) : null}

      <input
        id={idCampo}
        name={nombre}
        type={tipo}
        inputMode={numerico ? "numeric" : undefined}
        placeholder={marcador}
        defaultValue={valorInicial}
        aria-invalid={tieneError}
        aria-describedby={
          [ayuda ? idAyuda : null, tieneError ? idError : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={[
          "min-h-12 rounded-lg border bg-white px-3 text-base text-zinc-900",
          "focus:ring-2 focus:ring-stone-500 focus:outline-none",
          tieneError ? "border-red-600" : "border-zinc-300",
        ].join(" ")}
      />

      {tieneError ? (
        <p
          id={idError}
          role="alert"
          className="text-sm font-medium text-red-700"
        >
          {errores?.[0]}
        </p>
      ) : null}
    </div>
  );
}
