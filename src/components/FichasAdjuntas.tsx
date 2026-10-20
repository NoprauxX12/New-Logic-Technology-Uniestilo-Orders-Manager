import type { FichaVisible } from "@/lib/storage/fichas";

/**
 * Lista de fichas técnicas para abrir. La usan diseño, el tablero y las
 * pantallas de cada sección: todo el equipo tiene que poder ver el archivo.
 */

type Props = {
  fichas: FichaVisible[];
  /** Quién y cuándo, para el detalle del tablero. */
  conMeta?: boolean;
};

function formatoFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

export function FichasAdjuntas({ fichas, conMeta = false }: Props) {
  if (fichas.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        Todavía no hay ficha técnica en esta orden.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {fichas.map((ficha) => (
        <li key={ficha.id}>
          {ficha.url ? (
            <a
              href={ficha.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-base font-medium text-stone-800 underline underline-offset-2 hover:text-stone-950"
            >
              Ver {ficha.nombre}
            </a>
          ) : (
            <span className="text-sm text-zinc-700">{ficha.nombre}</span>
          )}
          {conMeta ? (
            <p className="text-sm text-zinc-600">
              Subida por{" "}
              <span className="font-medium text-zinc-800">
                {ficha.subidaPor}
              </span>{" "}
              · {formatoFechaHora(ficha.fechaSubida)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
