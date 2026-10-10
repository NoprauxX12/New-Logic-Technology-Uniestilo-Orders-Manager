"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { preguntarAlAsistente } from "@/features/asistente/actions";
import type { MensajeChat } from "@/lib/ai";

/**
 * HU-15 · El asistente de administración: un botón flotante abajo a la derecha
 * y un panel lateral que se abre encima de cualquier pantalla con sesión.
 *
 * La conversación vive aquí, en el navegador: se manda completa en cada
 * pregunta y la action recorta lo que no cabe en el contexto configurado. Al
 * recargar la página se pierde, a propósito: no hay historial persistente.
 *
 * Pensado para gente poco digital (RNF-08/09/10): una sola acción (preguntar),
 * botones grandes, preguntas de ejemplo para arrancar, y en celular el panel
 * ocupa toda la pantalla.
 */

const SUGERENCIAS = [
  "¿En qué va la orden OC-5003?",
  "¿Cuántas órdenes hay atrasadas?",
  "¿Qué le falta a la orden del Colegio San José?",
];

const BIENVENIDA =
  "Pregúntame por el estado de una orden, por su número o por el cliente. Solo consulto: no hago cambios.";

export function AsistenteFlotante() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finDeLaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finDeLaLista.current?.scrollIntoView({ block: "end" });
  }, [mensajes, cargando]);

  async function enviar(texto: string) {
    const contenido = texto.trim();
    if (!contenido || cargando) return;

    const conversacion: MensajeChat[] = [
      ...mensajes,
      { rol: "usuario", contenido },
    ];
    setMensajes(conversacion);
    setPregunta("");
    setError(null);
    setCargando(true);

    try {
      const respuesta = await preguntarAlAsistente(conversacion);
      if (respuesta.ok) {
        setMensajes([
          ...conversacion,
          { rol: "asistente", contenido: respuesta.texto },
        ]);
      } else {
        setError(respuesta.mensaje);
      }
    } catch {
      setError("No se pudo hablar con el asistente. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void enviar(pregunta);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="bg-marca hover:bg-marca-oscuro focus:ring-marca fixed right-4 bottom-4 z-40 flex min-h-14 items-center gap-2 rounded-full px-5 text-base font-semibold text-white shadow-lg focus:ring-2 focus:ring-offset-2 focus:outline-none"
      >
        <IconoChat />
        Asistente
      </button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="asistente-titulo"
      className="fixed inset-0 z-50 flex flex-col bg-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[26rem] sm:border-l sm:border-zinc-200"
    >
      <header className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <h2
          id="asistente-titulo"
          className="flex items-center gap-2 text-lg font-semibold text-zinc-900"
        >
          <IconoChat />
          Asistente
        </h2>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
        >
          Cerrar
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="flex flex-col gap-3" aria-live="polite">
          <Burbuja rol="asistente">{BIENVENIDA}</Burbuja>
          {mensajes.map((mensaje, indice) => (
            <Burbuja key={indice} rol={mensaje.rol}>
              {mensaje.contenido}
            </Burbuja>
          ))}
          {cargando ? (
            <Burbuja rol="asistente">
              <span className="text-zinc-500">Consultando las órdenes…</span>
            </Burbuja>
          ) : null}
        </ul>

        {mensajes.length === 0 ? (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm text-zinc-600">Por ejemplo:</p>
            {SUGERENCIAS.map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                onClick={() => void enviar(sugerencia)}
                disabled={cargando}
                className="min-h-11 rounded-lg border border-zinc-300 px-3 text-left text-sm text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              >
                {sugerencia}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        ) : null}
        <div ref={finDeLaLista} />
      </div>

      <form
        onSubmit={alEnviar}
        className="flex gap-2 border-t border-zinc-200 px-4 py-3"
      >
        <label htmlFor="asistente-pregunta" className="sr-only">
          Tu pregunta
        </label>
        <input
          id="asistente-pregunta"
          value={pregunta}
          onChange={(evento) => setPregunta(evento.target.value)}
          placeholder="¿En qué va la orden…?"
          autoComplete="off"
          disabled={cargando}
          className="focus:ring-marca min-h-12 flex-1 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 focus:ring-2 focus:outline-none disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={cargando || pregunta.trim() === ""}
          className="bg-marca hover:bg-marca-oscuro min-h-12 rounded-lg px-4 text-base font-semibold text-white disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </aside>
  );
}

function Burbuja({
  rol,
  children,
}: {
  rol: MensajeChat["rol"];
  children: React.ReactNode;
}) {
  const esPersona = rol === "usuario";
  return (
    <li
      className={[
        "max-w-[90%] rounded-2xl px-4 py-2 text-base whitespace-pre-wrap",
        esPersona
          ? "bg-marca self-end text-white"
          : "self-start bg-zinc-100 text-zinc-900",
      ].join(" ")}
    >
      {children}
    </li>
  );
}

function IconoChat() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
    </svg>
  );
}
