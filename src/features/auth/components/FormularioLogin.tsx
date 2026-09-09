"use client";

import { useActionState } from "react";

import { CampoTexto } from "@/components/ui/CampoTexto";
import {
  iniciarSesion,
  type EstadoIniciarSesion,
} from "@/features/auth/actions";

/**
 * HU-16 · Formulario de inicio de sesión.
 *
 * No usa `required` del navegador a propósito, igual que el resto de la
 * aplicación: la validación sale del esquema de zod, para que el mensaje esté
 * en el mismo lugar y en el mismo idioma que los de Supabase.
 */

const ESTADO_INICIAL: EstadoIniciarSesion = {
  ok: false,
  mensaje: "",
  email: "",
};

type Props = {
  /** Adónde volver tras entrar. */
  next: string;
};

export function FormularioLogin({ next }: Props) {
  const [estado, enviar, enviando] = useActionState(
    iniciarSesion,
    ESTADO_INICIAL,
  );

  return (
    <form action={enviar} className="flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />

      {estado.mensaje ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
        >
          {estado.mensaje}
        </p>
      ) : null}

      <CampoTexto
        nombre="email"
        etiqueta="Correo"
        tipo="email"
        marcador="tucorreo@uniestilo.test"
        autocompletar="username"
        valorInicial={estado.email}
      />

      <CampoTexto
        nombre="password"
        etiqueta="Contraseña"
        tipo="password"
        autocompletar="current-password"
      />

      <button
        type="submit"
        disabled={enviando}
        className="min-h-14 rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
