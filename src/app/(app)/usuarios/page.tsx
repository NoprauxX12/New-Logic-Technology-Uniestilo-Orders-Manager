import type { Metadata } from "next";

import { exigirAcceso } from "@/features/auth/guardia";
import { FormularioNuevoUsuario } from "@/features/usuarios/components/FormularioNuevoUsuario";
import { ListaUsuarios } from "@/features/usuarios/components/ListaUsuarios";
import { listarUsuarios } from "@/features/usuarios/queries";

export const metadata: Metadata = {
  title: "Personas · Uniestilo",
};

/** HU-24 · Pantalla de administración para crear cuentas. Solo enruta. */
export default async function UsuariosPage() {
  const quien = await exigirAcceso("/usuarios");

  const usuarios = await listarUsuarios();

  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8">
        <header className="space-y-1">
          <p className="text-sm font-medium text-stone-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Personas
          </h1>
          <p className="text-base text-zinc-600">
            Crea la cuenta de cada persona del taller, dale su rol, y edítala,
            desactívala o bórrala cuando haga falta.
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">Nueva cuenta</h2>
          <FormularioNuevoUsuario />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Con cuenta ({usuarios.length})
          </h2>
          <ListaUsuarios usuarios={usuarios} quienId={quien.id} />
        </section>
      </main>
    </div>
  );
}
