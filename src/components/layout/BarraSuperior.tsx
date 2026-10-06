import Link from "next/link";

import { cerrarSesion } from "@/features/auth/actions";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";
import type { UsuarioActual } from "@/lib/auth/usuarioActual";

/**
 * La barra de arriba de toda pantalla con sesión (HU-16): quién está dentro,
 * cómo volver al inicio y cómo salir. Sin esto, quien entraba a su pantalla
 * no tenía manera de cerrar sesión salvo volviendo a la portada a mano.
 */
export function BarraSuperior({ usuario }: { usuario: UsuarioActual }) {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/"
          className="min-h-11 content-center text-base font-semibold text-stone-700 hover:text-stone-900"
        >
          Uniestilo · Inicio
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-zinc-700">
            <span className="font-medium text-zinc-900">{usuario.nombre}</span>{" "}
            · {ETIQUETAS_ROL[usuario.rol]}
          </p>

          <form action={cerrarSesion}>
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
