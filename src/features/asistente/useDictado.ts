import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * HU-15 · Dictado por voz con la Web Speech API del navegador (Chrome, Edge,
 * Safari). Sin librería: el navegador transcribe y entrega el texto; aquí solo
 * se abre y se cierra el micrófono. En navegadores sin soporte (Firefox)
 * `soportado` queda en false y el panel no muestra el botón.
 *
 * Es un hook y no un componente porque el panel necesita el texto para
 * ponerlo en su propio campo; el botón es del panel.
 */

type EventoResultado = { results: SpeechRecognitionResultList };
type EventoError = { error: string };

/**
 * Lo que se usa de la API. TypeScript trae los tipos de los resultados pero
 * no el del reconocedor en sí, así que se declara lo mínimo.
 */
export type ReconocimientoDeVoz = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((evento: EventoResultado) => void) | null;
  onerror: ((evento: EventoError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export type ConstructorReconocimiento = new () => ReconocimientoDeVoz;

function constructorDelNavegador(): ConstructorReconocimiento | null {
  if (typeof window === "undefined") return null;
  const ventana = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };
  return ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition ?? null;
}

/** Errores que no hay que mostrar: la persona paró, o no dijo nada. */
const ERRORES_SILENCIOSOS = new Set(["aborted", "no-speech"]);

function mensajeDeError(codigo: string): string {
  if (codigo === "not-allowed" || codigo === "service-not-allowed") {
    return "El navegador no dejó usar el micrófono. Revisa el permiso y vuelve a intentar.";
  }
  if (codigo === "audio-capture") return "No se encontró un micrófono.";
  if (codigo === "network") {
    return "El dictado necesita internet y no hubo conexión.";
  }
  return "No se pudo dictar. Escribe la pregunta.";
}

/**
 * Si el navegador tiene reconocimiento de voz. Se lee como "store externo"
 * para que en el servidor sea false, en el navegador sea lo real y React
 * concilie la diferencia al hidratar sin un setState en un efecto.
 */
const sinSuscripcion = () => () => {};
const leerSoporte = () => constructorDelNavegador() !== null;
const soporteEnServidor = () => false;

type Opciones = {
  /** Se llama con lo transcrito hasta el momento; `final` cuando ya no cambia. */
  alTexto: (texto: string, final: boolean) => void;
  alFallo: (mensaje: string) => void;
};

export function useDictado({ alTexto, alFallo }: Opciones) {
  const soportado = useSyncExternalStore(
    sinSuscripcion,
    leerSoporte,
    soporteEnServidor,
  );
  const [escuchando, setEscuchando] = useState(false);
  const reconocimiento = useRef<ReconocimientoDeVoz | null>(null);
  const callbacks = useRef<Opciones>({ alTexto, alFallo });

  useEffect(() => {
    callbacks.current = { alTexto, alFallo };
  });

  useEffect(() => () => reconocimiento.current?.abort(), []);

  const alternar = useCallback(() => {
    if (reconocimiento.current) {
      reconocimiento.current.stop();
      return;
    }

    const Reconocimiento = constructorDelNavegador();
    if (!Reconocimiento) return;

    const instancia = new Reconocimiento();
    instancia.lang = "es-CO";
    instancia.interimResults = true;
    instancia.continuous = false;
    instancia.maxAlternatives = 1;

    instancia.onresult = (evento) => {
      const resultados = Array.from(evento.results);
      const texto = resultados
        .map((resultado) => resultado[0]?.transcript ?? "")
        .join(" ")
        .trim();
      const final = resultados.at(-1)?.isFinal ?? false;
      callbacks.current.alTexto(texto, final);
    };
    instancia.onerror = (evento) => {
      if (!ERRORES_SILENCIOSOS.has(evento.error)) {
        callbacks.current.alFallo(mensajeDeError(evento.error));
      }
    };
    instancia.onend = () => {
      reconocimiento.current = null;
      setEscuchando(false);
    };

    reconocimiento.current = instancia;
    setEscuchando(true);
    instancia.start();
  }, []);

  return { soportado, escuchando, alternar };
}
