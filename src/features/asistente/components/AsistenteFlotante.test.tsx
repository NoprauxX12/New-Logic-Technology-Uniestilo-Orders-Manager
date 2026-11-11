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
 * HU-15 y HU-21 · El panel del asistente. Las actions se sustituyen porque
 * arrastran `server-only`; aquí se prueba qué manda y qué pinta con la
 * respuesta.
 */

const preguntarAlAsistente = vi.hoisted(() => vi.fn());
const resumenProactivo = vi.hoisted(() => vi.fn());

vi.mock("@/features/asistente/actions", () => ({
  preguntarAlAsistente,
  resumenProactivo,
}));

/** Lo que el asistente dice solo al abrir (HU-21). */
const RESUMEN = "Hoy tienes 1 orden atrasada.";
const MENSAJE_RESUMEN = { rol: "asistente", contenido: RESUMEN } as const;

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

/** Abre el panel y espera el resumen proactivo, que llega antes de poder preguntar. */
async function abrir() {
  fireEvent.click(screen.getByRole("button", { name: /asistente/i }));
  await screen.findByText(RESUMEN);
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
    resumenProactivo.mockResolvedValue({ ok: true, texto: RESUMEN });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "SpeechRecognition");
  });

  it("arranca cerrado y se abre con el botón flotante", async () => {
    render(<AsistenteFlotante />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await abrir();
    expect(
      screen.getByRole("dialog", { name: "Asistente" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/solo consulto/i)).toBeInTheDocument();
  });

  it("al cerrar se desliza antes de desaparecer y conserva la conversación", async () => {
    preguntarAlAsistente.mockResolvedValue({ ok: true, texto: "Siete." });
    render(<AsistenteFlotante />);
    await abrir();
    preguntar("¿Cuántas órdenes hay?");
    await screen.findByText("Siete.");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    // Sigue en pantalla mientras sale, fuera de su sitio.
    expect(screen.getByRole("dialog")).toHaveClass("translate-x-full");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await abrir();
    expect(screen.getByText("Siete.")).toBeInTheDocument();
  });

  it("se cierra con Escape", async () => {
    render(<AsistenteFlotante />);
    await abrir();

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
    await abrir();

    preguntar("¿En qué va la OC-5003?");

    expect(preguntarAlAsistente).toHaveBeenCalledWith([
      MENSAJE_RESUMEN,
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
    await abrir();

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
    await abrir();

    preguntar("¿Cuántas órdenes hay?");
    await screen.findByText("Siete.");
    preguntar("¿Y atrasadas?");

    expect(preguntarAlAsistente).toHaveBeenLastCalledWith([
      MENSAJE_RESUMEN,
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
    await abrir();

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
    await abrir();

    preguntar("Hola");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El asistente no está configurado.",
    );
  });

  it("las preguntas de ejemplo se envían con un toque", async () => {
    preguntarAlAsistente.mockResolvedValue({ ok: true, texto: "Dos." });
    render(<AsistenteFlotante />);
    await abrir();

    fireEvent.click(
      screen.getByRole("button", { name: "¿Cuántas órdenes hay atrasadas?" }),
    );

    expect(preguntarAlAsistente).toHaveBeenCalledWith([
      MENSAJE_RESUMEN,
      { rol: "usuario", contenido: "¿Cuántas órdenes hay atrasadas?" },
    ]);
    expect(await screen.findByText("Dos.")).toBeInTheDocument();
  });

  it("no manda una pregunta vacía", async () => {
    render(<AsistenteFlotante />);
    await abrir();

    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("sin reconocimiento de voz en el navegador no hay botón de dictado", async () => {
    render(<AsistenteFlotante />);
    await abrir();

    expect(
      screen.queryByRole("button", { name: /dictar/i }),
    ).not.toBeInTheDocument();
  });

  it("dicta la pregunta al campo y queda lista para enviar", async () => {
    conDictado();
    render(<AsistenteFlotante />);
    await abrir();

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
    await abrir();

    fireEvent.click(screen.getByRole("button", { name: "Dictar la pregunta" }));
    const [reconocedor] = ReconocimientoFalso.instancias;
    act(() => {
      reconocedor.onerror?.({ error: "not-allowed" });
      reconocedor.onend?.();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(/micrófono/);
  });
  describe("HU-21 · proactivo", () => {
    it("al abrir cuenta solo lo pendiente, una sola vez por carga de la página", async () => {
      let resolver: (valor: unknown) => void = () => {};
      resumenProactivo.mockReturnValue(
        new Promise((res) => {
          resolver = res;
        }),
      );
      render(<AsistenteFlotante />);

      fireEvent.click(screen.getByRole("button", { name: /asistente/i }));

      expect(screen.getByText("Revisando lo pendiente…")).toBeInTheDocument();
      expect(screen.getByLabelText("Tu pregunta")).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "¿Qué tengo pendiente hoy?" }),
      ).not.toBeInTheDocument();

      await act(async () => {
        resolver({ ok: true, texto: RESUMEN });
      });

      expect(screen.getByText(RESUMEN)).toBeInTheDocument();
      expect(
        screen.queryByText("Revisando lo pendiente…"),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Tu pregunta")).toBeEnabled();

      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /asistente/i }));

      expect(resumenProactivo).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText(RESUMEN)).toHaveLength(1);
    });

    it("pinta el resumen como Markdown, con el enlace a la orden", async () => {
      resumenProactivo.mockResolvedValue({
        ok: true,
        texto:
          "**Atrasadas (1)**\n\n- OC-5005: se venció hace 2 días. [Consúltala aquí](/tablero/00000000-0000-0000-0000-0000000000f5)",
      });
      render(<AsistenteFlotante />);

      fireEvent.click(screen.getByRole("button", { name: /asistente/i }));

      expect(
        await screen.findByRole("link", { name: "Consúltala aquí" }),
      ).toHaveAttribute(
        "href",
        "/tablero/00000000-0000-0000-0000-0000000000f5",
      );
      expect(screen.getByText("Atrasadas (1)").tagName).toBe("STRONG");
    });

    it("si no pudo revisar lo pendiente lo dice y deja preguntar", async () => {
      resumenProactivo.mockResolvedValue({
        ok: false,
        mensaje: "No pude revisar lo pendiente en este momento.",
      });
      preguntarAlAsistente.mockResolvedValue({ ok: true, texto: "Siete." });
      render(<AsistenteFlotante />);

      fireEvent.click(screen.getByRole("button", { name: /asistente/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "No pude revisar lo pendiente",
      );

      preguntar("¿Cuántas órdenes hay?");
      expect(preguntarAlAsistente).toHaveBeenCalledWith([
        { rol: "usuario", contenido: "¿Cuántas órdenes hay?" },
      ]);
      expect(await screen.findByText("Siete.")).toBeInTheDocument();
    });

    it("si la conexión falla al revisar, avisa sin romper el panel", async () => {
      resumenProactivo.mockRejectedValue(new Error("red"));
      render(<AsistenteFlotante />);

      fireEvent.click(screen.getByRole("button", { name: /asistente/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/conexión/);
      expect(screen.getByLabelText("Tu pregunta")).toBeEnabled();
    });

    it("las preguntas de ejemplo se quitan después de la primera pregunta", async () => {
      preguntarAlAsistente.mockResolvedValue({ ok: true, texto: "Dos." });
      render(<AsistenteFlotante />);
      await abrir();

      expect(
        screen.getByRole("button", { name: "¿Qué tengo pendiente hoy?" }),
      ).toBeInTheDocument();

      preguntar("¿Cuántas hay?");
      await screen.findByText("Dos.");

      expect(
        screen.queryByRole("button", { name: "¿Qué tengo pendiente hoy?" }),
      ).not.toBeInTheDocument();
    });

    it("el botón muestra cuántas cosas hay por atender", () => {
      render(<AsistenteFlotante porAtender={5} />);

      const boton = screen.getByRole("button", {
        name: "Asistente, 5 cosas por atender",
      });
      expect(boton).toHaveTextContent("5");
    });

    it("dice «cosa» en singular y recorta números grandes", () => {
      const { rerender } = render(<AsistenteFlotante porAtender={1} />);
      expect(
        screen.getByRole("button", { name: "Asistente, 1 cosa por atender" }),
      ).toBeInTheDocument();

      rerender(<AsistenteFlotante porAtender={140} />);
      expect(
        screen.getByRole("button", {
          name: "Asistente, 140 cosas por atender",
        }),
      ).toHaveTextContent("99+");
    });

    it("sin nada por atender no muestra número", () => {
      render(<AsistenteFlotante porAtender={0} />);

      expect(
        screen.getByRole("button", { name: "Asistente" }),
      ).toHaveTextContent(/^Asistente$/);
    });
  });
});
