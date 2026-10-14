"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { preguntarAlAsistente } from "@/features/asistente/actions";
import { TextoAsistente } from "@/features/asistente/components/TextoAsistente";
import { useDictado } from "@/features/asistente/useDictado";
import type { MensajeChat } from "@/lib/ai";

/**
 * HU-15 · El asistente de administración: un botón flotante abajo a la derecha
 * y un panel lateral que entra deslizándose desde la derecha, encima de
 * cualquier pantalla con sesión.
 *
 * La conversación vive aquí, en el navegador: se manda completa en cada
 * pregunta y la capa de IA recorta lo que no cabe en el contexto configurado.
 * Al recargar la página se pierde, a propósito: no hay historial persistente.
 * Cerrar el panel no la borra: el componente sigue montado.
 *
 * Pensado para gente poco digital (RNF-08/09/10): una sola acción (preguntar),
 * botones grandes, dictado por voz, preguntas de ejemplo para arrancar, y en
 * celular el panel ocupa toda la pantalla.
 */

const SUGERENCIAS = [
  "¿En qué va la orden OC-5003?",
  "¿Cuántas órdenes hay atrasadas?",
  "¿Qué le falta a la orden del Colegio San José?",
];

const BIENVENIDA =
  "Pregúntame por el estado de una orden, por su número o por el cliente. Solo consulto: no hago cambios.";

/** Lo que dura el panel entrando o saliendo. Igual que `duration-300`. */
const DURACION_TRANSICION_MS = 300;

export function AsistenteFlotante() {
  // `montado` es si el panel está en el DOM; `visible` es si está en su sitio
  // o fuera de la pantalla. Al cerrar, primero se desliza y luego se desmonta.
  const [montado, setMontado] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finDeLaLista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const temporizadorCierre = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dictado = useDictado({
    alTexto: (texto) => setPregunta(texto),
    alFallo: (mensaje) => setError(mensaje),
  });

  const cerrar = useCallback(() => {
    setVisible(false);
    temporizadorCierre.current = setTimeout(() => {
      setMontado(false);
      temporizadorCierre.current = null;
    }, DURACION_TRANSICION_MS);
  }, []);

  function abrir() {
    if (temporizadorCierre.current) {
      clearTimeout(temporizadorCierre.current);
      temporizadorCierre.current = null;
    }
    setMontado(true);
    setVisible(true);
  }

  useEffect(
    () => () => {
      if (temporizadorCierre.current) clearTimeout(temporizadorCierre.current);
    },
    [],
  );

  useEffect(() => {
    if (!visible) return;
    campo.current?.focus();

    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") cerrar();
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [visible, cerrar]);

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

  if (!montado) {
    return (
      <button
        type="button"
        onClick={abrir}
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
      className={[
        "fixed inset-0 z-50 flex flex-col bg-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[26rem] sm:border-l sm:border-zinc-200",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        // `starting:` es @starting-style: el primer cuadro tras montarse arranca
        // fuera de la pantalla y la transición lo trae. Al cerrar, `visible`
        // en false lo manda de vuelta y el temporizador lo desmonta después.
        visible
          ? "translate-x-0 starting:translate-x-full"
          : "translate-x-full",
      ].join(" ")}
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
          onClick={cerrar}
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
              {mensaje.rol === "asistente" ? (
                <TextoAsistente texto={mensaje.contenido} alNavegar={cerrar} />
              ) : (
                mensaje.contenido
              )}
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
          ref={campo}
          id="asistente-pregunta"
          value={pregunta}
          onChange={(evento) => setPregunta(evento.target.value)}
          placeholder={
            dictado.escuchando ? "Escuchando…" : "¿En qué va la orden…?"
          }
          autoComplete="off"
          disabled={cargando}
          className="focus:ring-marca min-h-12 min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 focus:ring-2 focus:outline-none disabled:bg-zinc-50"
        />
        {dictado.soportado ? (
          <button
            type="button"
            onClick={dictado.alternar}
            disabled={cargando}
            aria-pressed={dictado.escuchando}
            aria-label={
              dictado.escuchando ? "Parar el dictado" : "Dictar la pregunta"
            }
            className={[
              "flex min-h-12 min-w-12 items-center justify-center rounded-lg border disabled:opacity-50",
              dictado.escuchando
                ? "animate-pulse border-red-600 bg-red-50 text-red-700"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50",
            ].join(" ")}
          >
            <IconoMicrofono />
          </button>
        ) : null}
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
  children: ReactNode;
}) {
  const esPersona = rol === "usuario";
  return (
    <li
      className={[
        "max-w-[90%] rounded-2xl px-4 py-2 text-base",
        esPersona
          ? "bg-marca self-end whitespace-pre-wrap text-white"
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

function IconoMicrofono() {
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
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}
