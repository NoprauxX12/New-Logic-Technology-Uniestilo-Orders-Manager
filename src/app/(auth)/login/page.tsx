import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
 * El fondo se fija en blanco por la misma razón que `ordenes/nueva`: el
 * `globals.css` heredado del andamiaje oscurece el `body` en modo oscuro, y la
 * aplicación no tiene todavía una paleta para ese modo.
 */
type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const usuario = await getUsuarioActual();
  if (usuario) redirect("/");

  const { next } = await searchParams;

  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-8 px-4 py-16">
        <header className="space-y-1 text-center">
          <p className="text-sm font-medium text-stone-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Iniciar sesión
          </h1>
          <p className="text-base text-zinc-600">
            Entra con tu correo y tu contraseña.
          </p>
        </header>

        <FormularioLogin next={next ?? "/"} />
      </main>
    </div>
  );
}
