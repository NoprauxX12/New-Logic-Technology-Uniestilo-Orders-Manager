import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AsistenteFlotante } from "@/features/asistente/components/AsistenteFlotante";

/**
 * HU-15 · El panel del asistente. La action se sustituye porque arrastra
 * `server-only`; aquí se prueba qué manda y qué pinta con la respuesta.
 */

const preguntarAlAsistente = vi.hoisted(() => vi.fn());

vi.mock("@/features/asistente/actions", () => ({ preguntarAlAsistente }));

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

  it("arranca cerrado y se abre con el botón flotante", () => {
    render(<AsistenteFlotante />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    abrir();
    expect(
      screen.getByRole("dialog", { name: "Asistente" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/solo consulto/i)).toBeInTheDocument();
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
});
