import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoAtencionAlerta } from "@/features/alertas/actions";
import { BotonAtenderAlerta } from "@/features/alertas/components/BotonAtenderAlerta";

const atenderAlertaDeTela = vi.hoisted(() => vi.fn());

vi.mock("@/features/alertas/actions", () => ({ atenderAlertaDeTela }));

const ALERTA_ID = "00000000-0000-0000-0000-0000000000b1";

describe("BotonAtenderAlerta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atenderAlertaDeTela.mockResolvedValue({
      ok: true,
      mensaje: "Alerta resuelta.",
    } satisfies EstadoAtencionAlerta);
  });

  it("es un solo botón, sin pedir quién la resuelve", () => {
    render(<BotonAtenderAlerta alertaId={ALERTA_ID} />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Marcar como resuelta" }),
    ).toBeInTheDocument();
  });

  it("manda solo el id de la alerta", async () => {
    render(<BotonAtenderAlerta alertaId={ALERTA_ID} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Marcar como resuelta" }),
    );

    await waitFor(() => expect(atenderAlertaDeTela).toHaveBeenCalledTimes(1));

    const [, formData] = atenderAlertaDeTela.mock.calls[0] as [
      EstadoAtencionAlerta,
      FormData,
    ];

    expect([...formData.keys()]).toEqual(["alertaId"]);
    expect(formData.get("alertaId")).toBe(ALERTA_ID);
  });

  it("pinta el error si ya estaba resuelta", async () => {
    atenderAlertaDeTela.mockResolvedValue({
      ok: false,
      mensaje: "Esa alerta ya estaba resuelta.",
    } satisfies EstadoAtencionAlerta);

    render(<BotonAtenderAlerta alertaId={ALERTA_ID} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Marcar como resuelta" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ya estaba resuelta",
    );
  });
});
