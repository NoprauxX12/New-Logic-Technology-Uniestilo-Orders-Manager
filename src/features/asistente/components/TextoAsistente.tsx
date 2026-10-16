import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * HU-15 · Cómo se pinta lo que escribe el modelo. Responde en Markdown
 * (negritas, viñetas y el enlace "Consúltala aquí"), y esto lo convierte en
 * HTML seguro: nada de HTML crudo, y solo se vuelven enlaces las rutas de la
 * propia aplicación (`/tablero/...`); cualquier otra dirección se deja como
 * texto, porque el modelo no tiene por qué mandar a nadie afuera.
 *
 * Si a pesar de las instrucciones llega una tabla, se deja desplazar de lado
 * en vez de reventar el panel.
 */

type Props = {
  texto: string;
  /** Se llama al tocar un enlace interno, para que el panel se quite de encima. */
  alNavegar?: () => void;
};

function componentesDe(alNavegar?: () => void): Components {
  return {
    a: ({ href, children }) =>
      href?.startsWith("/") ? (
        <Link
          href={href}
          onClick={alNavegar}
          className="text-marca hover:text-marca-oscuro font-semibold underline underline-offset-2"
        >
          {children}
        </Link>
      ) : (
        <>{children}</>
      ),
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => (
      <ul className="mb-2 list-disc space-y-2 pl-5 last:mb-0">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 list-decimal space-y-2 pl-5 last:mb-0">{children}</ol>
    ),
    h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
    h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
    h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
    h4: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
    table: ({ children }) => (
      <div className="mb-2 overflow-x-auto last:mb-0">
        <table className="text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border-b border-zinc-300 px-2 py-1 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border-b border-zinc-200 px-2 py-1 align-top">
        {children}
      </td>
    ),
  };
}

export function TextoAsistente({ texto, alNavegar }: Props) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={componentesDe(alNavegar)}
      skipHtml
    >
      {texto}
    </Markdown>
  );
}
