import type { Metadata } from "next";

import { FormularioNuevaOrden } from "@/features/ordenes/components/FormularioNuevaOrden";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

export const metadata: Metadata = {
  title: "Registrar orden · Uniestilo",
};

/**
 * HU-01 · Pantalla de registro. Solo enruta: la lógica vive en la feature.
 *
 * Registrar órdenes es del administrador, así que a las demás secciones se les
 * dice que esta pantalla no es suya en vez de mostrarles un formulario que la
 * action les va a rechazar.
 *
 * Es una guarda provisional y de una sola capa: mientras no exista el login
 * (HU-16) la persona sale de un desplegable que cualquiera puede cambiar, y las
 * políticas RLS siguen abiertas. HU-17 la reemplaza por la de verdad, en la UI
 * y en la base a la vez. Lo que sí protege desde ya es la action, que también
 * verifica el rol: sin eso esto sería un letrero y no una validación.
 *
 * El fondo se fija en blanco a propósito. El `globals.css` heredado del
 * andamiaje oscurece el `body` cuando el sistema está en modo oscuro, pero la
 * aplicación no tiene todavía una paleta para ese modo y el texto quedaría
 * ilegible. Qué hacer con el tema oscuro es una decisión de todo el equipo.
 */
export default async function NuevaOrdenPage() {
  const usuario = await getUsuarioActual();

  return (
    <div className="flex-1 bg-white">
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <header className="mb-8 space-y-1">
          <p className="text-sm font-medium text-stone-600">Uniestilo</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Registrar una orden
          </h1>
          <p className="text-base text-zinc-600">
            Los datos del pedido y las prendas que hay que confeccionar.
          </p>
        </header>

        {usuario?.rol === "admin" ? (
          <FormularioNuevaOrden />
        ) : (
          <p
            role="status"
            className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-base text-zinc-700"
          >
            {usuario
              ? "Las órdenes las registra administración. Escoge arriba esa persona si te toca a ti."
              : "Escoge arriba con qué persona estás trabajando."}
          </p>
        )}
      </main>
    </div>
  );
}
