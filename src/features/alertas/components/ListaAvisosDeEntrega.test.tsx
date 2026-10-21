import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListaAvisosDeEntrega } from "@/features/alertas/components/ListaAvisosDeEntrega";
import type { AvisoDeEntrega } from "@/features/alertas/queries";

const atenderAvisoDeEntrega = vi.hoisted(() => vi.fn());

vi.mock("@/features/alertas/actions", () => ({ atenderAvisoDeEntrega }));

// 20 oct 2026, mediodía en Marinilla.
const AHORA = new Date("2026-10-20T17:00:00Z");

const AVISO: AvisoDeEntrega = {
  tipo: "proximidad_entrega",
  id: "00000000-0000-0000-0000-0000000000b1",
  numeroOrdenCompra: "OC-5004",
  razonSocial: "Transportes La Mesa S.A.S.",
  fechaEntrega: "2026-10-22",
};

describe("ListaAvisosDeEntrega", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atenderAvisoDeEntrega.mockResolvedValue({ ok: true, mensaje: "Listo." });
  });

  it("no ocupa espacio si no hay avisos", () => {
    const { container } = render(
      <ListaAvisosDeEntrega avisos={[]} ahora={AHORA} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra la orden, el cliente y el plazo de hoy", () => {
    render(<ListaAvisosDeEntrega avisos={[AVISO]} ahora={AHORA} />);

    expect(screen.getByRole("region", { name: "Avisos" })).toBeInTheDocument();
    expect(screen.getByText("Entrega en 2 días · OC-5004")).toBeInTheDocument();
    expect(screen.getByText("Transportes La Mesa S.A.S.")).toBeInTheDocument();
  });

  it("a las 8 p. m. en Colombia cuenta el día de Colombia, no el de UTC", () => {
    // 21:00 en Marinilla del 20 de oct = 02:00 UTC del 21.
    render(
      <ListaAvisosDeEntrega
        avisos={[{ ...AVISO, fechaEntrega: "2026-10-20" }]}
        ahora={new Date("2026-10-21T02:00:00Z")}
      />,
    );

    expect(screen.getByText("Entrega hoy · OC-5004")).toBeInTheDocument();
  });

  it("dice que se venció cuando la fecha ya pasó", () => {
    render(
      <ListaAvisosDeEntrega
        avisos={[{ ...AVISO, fechaEntrega: "2026-10-18" }]}
        ahora={AHORA}
      />,
    );

    expect(
      screen.getByText("Se venció hace 2 días · OC-5004"),
    ).toBeInTheDocument();
  });

  it("«Ya lo vi» es un solo botón que manda solo el id del aviso", async () => {
    render(<ListaAvisosDeEntrega avisos={[AVISO]} ahora={AHORA} />);

    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ya lo vi" }));

    await waitFor(() => expect(atenderAvisoDeEntrega).toHaveBeenCalledTimes(1));

    const formData = atenderAvisoDeEntrega.mock.calls[0][1] as FormData;
    expect(formData.get("alertaId")).toBe(AVISO.id);
    expect([...formData.keys()]).toEqual(["alertaId"]);
  });

  it("muestra el error si no se pudo marcar", async () => {
    atenderAvisoDeEntrega.mockResolvedValue({
      ok: false,
      mensaje: "Este aviso es de otra persona.",
    });
    render(<ListaAvisosDeEntrega avisos={[AVISO]} ahora={AHORA} />);

    fireEvent.click(screen.getByRole("button", { name: "Ya lo vi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este aviso es de otra persona.",
    );
  });
});
