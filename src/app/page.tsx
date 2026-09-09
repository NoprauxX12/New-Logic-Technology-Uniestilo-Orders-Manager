import type { Metadata } from "next";
import Link from "next/link";

import { cerrarSesion } from "@/features/auth/actions";
import { vistaDeRol } from "@/features/auth/vistaPorRol";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";
import { getUsuarioActual, type UsuarioActual } from "@/lib/auth/usuarioActual";

export const metadata: Metadata = {
  title: "Uniestilo · Gestor de órdenes",
};

/**
 * HU-16 · Punto de entrada. Sin sesión, es la portada; con sesión, es desde
 * donde cada persona entra a lo suyo — "un botón por rol", en vez de mandarla
 * derecho a su pantalla sin que se entere de dónde está.
 *
 * Es un Server Component `async`: por convención del repo, esos no se prueban
 * con Vitest (CLAUDE.md, sección de testing). El `page.test.tsx` que existía
 * probaba el `<h1>` de una versión estática; se borra con este cambio.
 */
export default async function HomePage() {
  const usuario = await getUsuarioActual();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Uniestilo · Gestor de órdenes</h1>

      {usuario ? (
        <PanelDePersona usuario={usuario} />
      ) : (
        <>
          <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            Sistema en construcción. Sprint 1: registro, corte, talleres,
            marcación, despacho y tablero.
          </p>
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center rounded-lg bg-stone-700 px-6 text-base font-semibold text-white hover:bg-stone-800"
          >
            Iniciar sesión
          </Link>
        </>
      )}
    </main>
  );
}

function PanelDePersona({ usuario }: { usuario: UsuarioActual }) {
  const vista = vistaDeRol(usuario.rol);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-lg text-zinc-700">
        Hola, <span className="font-semibold">{usuario.nombre}</span> ·{" "}
        {ETIQUETAS_ROL[usuario.rol]}
      </p>

      {vista.aviso ? (
        <p className="max-w-md text-base text-zinc-600">{vista.aviso}</p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        {vista.botones.map((boton) => (
          <Link
            key={boton.ruta}
            href={boton.ruta}
            className="inline-flex min-h-14 items-center rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800"
          >
            {boton.etiqueta}
          </Link>
        ))}
      </div>

      <form action={cerrarSesion}>
        <button
          type="submit"
          className="min-h-11 text-sm font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
