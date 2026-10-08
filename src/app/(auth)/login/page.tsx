import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { AccesoRapido } from "@/features/auth/components/AccesoRapido";
import { FormularioLogin } from "@/features/auth/components/FormularioLogin";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

export const metadata: Metadata = {
  title: "Iniciar sesión · Uniestilo",
};

/**
 * HU-16 · Pantalla de login. Solo enruta: la lógica vive en la feature.
 *
 * Quien ya tiene sesión no necesita ver el formulario otra vez: se manda
 * directo a `/`, que es quien decide a dónde va según el rol.
 *
 * El acceso rápido con las cuentas del seed solo aparece fuera de producción.
 */
type Props = {
  searchParams: Promise<{ next?: string }>;
};

const MOSTRAR_ACCESO_RAPIDO = process.env.NODE_ENV !== "production";

export default async function LoginPage({ searchParams }: Props) {
  const usuario = await getUsuarioActual();
  if (usuario) redirect("/");

  const { next } = await searchParams;

  return (
    <div className="flex flex-1 flex-col bg-stone-50">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-8 px-4 py-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-28 items-center justify-center rounded-3xl bg-white shadow-md ring-1 ring-zinc-200">
            <Image
              src="/logo-uniestilo.png"
              alt="Logo de Uniestilo"
              width={88}
              height={90}
              priority
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              Uniestilo
            </h1>
            <p className="text-base text-zinc-600">
              Sistema de seguimiento de producción
            </p>
          </div>
        </header>

        <section className="flex w-full flex-col gap-8 rounded-3xl bg-white p-6 shadow-md ring-1 ring-zinc-200 sm:p-8">
          <FormularioLogin next={next ?? "/"} />

          {MOSTRAR_ACCESO_RAPIDO ? (
            <>
              <hr className="border-zinc-200" />
              <AccesoRapido />
            </>
          ) : null}
        </section>
      </main>

      <footer className="pb-6 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} Uniestilo · v
        {process.env.NEXT_PUBLIC_VERSION}
      </footer>
    </div>
  );
}
