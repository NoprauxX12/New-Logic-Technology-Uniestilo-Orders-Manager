import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AsistenteFlotante } from "@/features/asistente/components/AsistenteFlotante";
import type { ReconocimientoDeVoz } from "@/features/asistente/useDictado";

/**
 * HU-15 · El panel del asistente. La action se sustituye porque arrastra
 * `server-only`; aquí se prueba qué manda y qué pinta con la respuesta.
 */

const preguntarAlAsistente = vi.hoisted(() => vi.fn());

vi.mock("@/features/asistente/actions", () => ({ preguntarAlAsistente }));

/** Un reconocedor de voz de mentira: el test dispara los eventos a mano. */
class ReconocimientoFalso implements ReconocimientoDeVoz {
  static instancias: ReconocimientoFalso[] = [];
  lang = "";
  interimResults = false;
  continuous = false;
  maxAlternatives = 0;
  onresult: ReconocimientoDeVoz["onresult"] = null;
  onerror: ReconocimientoDeVoz["onerror"] = null;
  onend: ReconocimientoDeVoz["onend"] = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();

  constructor() {
    ReconocimientoFalso.instancias.push(this);
  }

  dictar(transcript: string, isFinal = true) {
    const resultado = Object.assign([{ transcript, confidence: 1 }], {
      isFinal,
    });
    this.onresult?.({
      results: [resultado] as unknown as SpeechRecognitionResultList,
    });
  }
}

function conDictado() {
  ReconocimientoFalso.instancias = [];
  Object.defineProperty(window, "SpeechRecognition", {
    value: ReconocimientoFalso,
    configurable: true,
    writable: true,
  });
}

function abrir() {
  fireEvent.click(screen.getByRole("button", { name: /asistente/i }));
}

function preguntar(texto: string) {
  fireEvent.change(screen.getByLabelText("Tu pregunta"), {
    target: { value: texto },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
}

describe("AsistenteFlotante", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "SpeechRecognition");
  });

  it("arranca cerrado y se abre con el botón flotante", () => {
    render(<AsistenteFlotante />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    abrir();
    expect(
      screen.getByRole("dialog", { name: "Asistente" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/solo consulto/i)).toBeInTheDocument();
  });

  it("al cerrar se desliza antes de desaparecer y conserva la conversación", async () => {
    preguntarAlAsistente.mockResolvedValue({ ok: true, texto: "Siete." });
    render(<AsistenteFlotante />);
    abrir();
    preguntar("¿Cuántas órdenes hay?");
    await screen.findByText("Siete.");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    // Sigue en pantalla mientras sale, fuera de su sitio.
    expect(screen.getByRole("dialog")).toHaveClass("translate-x-full");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    abrir();
    expect(screen.getByText("Siete.")).toBeInTheDocument();
  });

  it("se cierra con Escape", async () => {
    render(<AsistenteFlotante />);
    abrir();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("manda la conversación completa y pinta la respuesta", async () => {
    preguntarAlAsistente.mockResolvedValue({
      ok: true,
      texto: "La orden OC-5003 va en corte completado.",
    });
    render(<AsistenteFlotante />);
    abrir();

    preguntar("¿En qué va la OC-5003?");

    expect(preguntarAlAsistente).toHaveBeenCalledWith([
      { rol: "usuario", contenido: "¿En qué va la OC-5003?" },
    ]);
    expect(
      await screen.findByText("La orden OC-5003 va en corte completado."),
    ).toBeInTheDocument();
    expect(screen.getByText("¿En qué va la OC-5003?")).toBeInTheDocument();
  });

  it("pinta la respuesta como Markdown y el enlace a la orden cierra el panel", async () => {
    preguntarAlAsistente.mockResolvedValue({
      ok: true,
      texto:
        "**OC-5003** va en corte completado. [Consúltala aquí](/tablero/00000000-0000-0000-0000-0000000000f3)",
    });
    render(<AsistenteFlotante />);
    abrir();

    preguntar("¿En qué va la 5003?");

    const enlace = await screen.findByRole("link", {
      name: "Consúltala aquí",
    });
    expect(enlace).toHaveAttribute(
      "href",
      "/tablero/00000000-0000-0000-0000-0000000000f3",
    );
    expect(screen.getByText("OC-5003").tagName).toBe("STRONG");

    fireEvent.click(enlace);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("incluye los turnos anteriores en la siguiente pregunta", async () => {
    preguntarAlAsistente.mockResolvedValue({ ok: true, texto: "Siete." });
    render(<AsistenteFlotante />);
    abrir();

    preguntar("¿Cuántas órdenes hay?");
    await screen.findByText("Siete.");
    preguntar("¿Y atrasadas?");

    expect(preguntarAlAsistente).toHaveBeenLastCalledWith([
      { rol: "usuario", contenido: "¿Cuántas órdenes hay?" },
      { rol: "asistente", contenido: "Siete." },
      { rol: "usuario", contenido: "¿Y atrasadas?" },
    ]);
  });

  it("deshabilita el envío mientras consulta", async () => {
    let resolver: (valor: unknown) => void = () => {};
    preguntarAlAsistente.mockReturnValue(
      new Promise((res) => {
        resolver = res;
      }),
    );
    render(<AsistenteFlotante />);
    abrir();

    preguntar("Hola");

    expect(screen.getByText(/consultando/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();

    resolver({ ok: true, texto: "Hola." });
    await waitFor(() =>
      expect(screen.queryByText(/consultando/i)).not.toBeInTheDocument(),
    );
  });

  it("muestra el mensaje de error de la action", async () => {
    preguntarAlAsistente.mockResolvedValue({
      ok: false,
      mensaje: "El asistente no está configurado.",
    });
    render(<AsistenteFlotante />);
    abrir();

    preguntar("Hola");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El asistente no está configurado.",
    );
  });

  it("las preguntas de ejemplo se envían con un toque", async () => {
    preguntarAlAsistente.mockResolvedValue({ ok: true, texto: "Dos." });
    render(<AsistenteFlotante />);
    abrir();

    fireEvent.click(
      screen.getByRole("button", { name: "¿Cuántas órdenes hay atrasadas?" }),
    );

    expect(preguntarAlAsistente).toHaveBeenCalledWith([
      { rol: "usuario", contenido: "¿Cuántas órdenes hay atrasadas?" },
    ]);
    expect(await screen.findByText("Dos.")).toBeInTheDocument();
  });

  it("no manda una pregunta vacía", () => {
    render(<AsistenteFlotante />);
    abrir();

    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("sin reconocimiento de voz en el navegador no hay botón de dictado", () => {
    render(<AsistenteFlotante />);
    abrir();

    expect(
      screen.queryByRole("button", { name: /dictar/i }),
    ).not.toBeInTheDocument();
  });

  it("dicta la pregunta al campo y queda lista para enviar", () => {
    conDictado();
    render(<AsistenteFlotante />);
    abrir();

    fireEvent.click(screen.getByRole("button", { name: "Dictar la pregunta" }));

    const [reconocedor] = ReconocimientoFalso.instancias;
    expect(reconocedor.start).toHaveBeenCalled();
    expect(reconocedor.lang).toBe("es-CO");
    expect(
      screen.getByRole("button", { name: "Parar el dictado" }),
    ).toHaveAttribute("aria-pressed", "true");

    // Los eventos del reconocedor llegan fuera de React: se envuelven en act.
    act(() => {
      reconocedor.dictar("cuántas órdenes hay atrasadas");
      reconocedor.onend?.();
    });

    expect(screen.getByLabelText("Tu pregunta")).toHaveValue(
      "cuántas órdenes hay atrasadas",
    );
    expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Dictar la pregunta" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("avisa si el navegador no dejó usar el micrófono", async () => {
    conDictado();
    render(<AsistenteFlotante />);
    abrir();

    fireEvent.click(screen.getByRole("button", { name: "Dictar la pregunta" }));
    const [reconocedor] = ReconocimientoFalso.instancias;
    act(() => {
      reconocedor.onerror?.({ error: "not-allowed" });
      reconocedor.onend?.();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/micrófono/);
  });
});
