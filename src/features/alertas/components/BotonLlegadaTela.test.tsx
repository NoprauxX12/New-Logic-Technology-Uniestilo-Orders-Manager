import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoLlegadaTela } from "@/features/alertas/actions";
import { BotonLlegadaTela } from "@/features/alertas/components/BotonLlegadaTela";

/**
 * HU-22 · El botón de llegada de la tela.
 *
 * La action de verdad importa `server-only` y Supabase, que no cargan en
 * jsdom: se reemplaza por una función falsa. Se prueba que solo mande la orden
 * —quién la recibió y cuándo los pone el servidor— y que pinte el error.
 */

const marcarLlegadaDeTela = vi.hoisted(() => vi.fn());

vi.mock("@/features/alertas/actions", () => ({ marcarLlegadaDeTela }));

const ORDEN_ID = "00000000-0000-0000-0000-0000000000f2";

describe("BotonLlegadaTela", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    marcarLlegadaDeTela.mockResolvedValue({
      ok: true,
      mensaje: "Tela recibida.",
    } satisfies EstadoLlegadaTela);
  });

  it("no pregunta nada: es un solo botón", () => {
    render(<BotonLlegadaTela ordenId={ORDEN_ID} />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Ya llegó la tela" }),
    ).toBeInTheDocument();
  });

  it("manda solo la orden, en un campo oculto", async () => {
    render(<BotonLlegadaTela ordenId={ORDEN_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "Ya llegó la tela" }));

    await waitFor(() => expect(marcarLlegadaDeTela).toHaveBeenCalledTimes(1));

    const [, formData] = marcarLlegadaDeTela.mock.calls[0] as [
      EstadoLlegadaTela,
      FormData,
    ];

    expect([...formData.keys()]).toEqual(["ordenId"]);
    expect(formData.get("ordenId")).toBe(ORDEN_ID);
  });

  it("pinta el error cuando otra persona ya la marcó", async () => {
    marcarLlegadaDeTela.mockResolvedValue({
      ok: false,
      mensaje: "Otra persona ya marcó que llegó la tela de esta orden.",
    } satisfies EstadoLlegadaTela);

    render(<BotonLlegadaTela ordenId={ORDEN_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "Ya llegó la tela" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Otra persona ya marcó",
    );
  });
});
