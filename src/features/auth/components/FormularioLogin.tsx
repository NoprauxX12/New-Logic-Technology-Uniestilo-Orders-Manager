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

function IconoPersona() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
    </svg>
  );
}

function IconoCandado() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

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
        marcador="tucorreo@uniestilo.com"
        autocompletar="username"
        valorInicial={estado.email}
        icono={<IconoPersona />}
      />

      <CampoTexto
        nombre="password"
        etiqueta="Contraseña"
        tipo="password"
        marcador="••••••••"
        autocompletar="current-password"
        icono={<IconoCandado />}
      />

      <button
        type="submit"
        disabled={enviando}
        className="bg-marca hover:bg-marca-oscuro mt-2 min-h-14 rounded-xl px-6 text-lg font-semibold text-white shadow-sm disabled:bg-zinc-400"
      >
        {enviando ? "Entrando…" : "Ingresar al sistema"}
      </button>
    </form>
  );
}
