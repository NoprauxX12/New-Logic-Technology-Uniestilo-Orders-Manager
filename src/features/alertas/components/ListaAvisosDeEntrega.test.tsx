import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ListaAvisosDeEntrega } from "@/features/alertas/components/ListaAvisosDeEntrega";
import type { AvisoDeEntrega } from "@/features/alertas/queries";

const atenderAvisoDeEntrega = vi.hoisted(() => vi.fn());

vi.mock("@/features/alertas/actions", () => ({ atenderAvisoDeEntrega }));

const HOY = "2026-10-20";

const AVISO: AvisoDeEntrega = {
  tipo: "proximidad_entrega",
  id: "00000000-0000-0000-0000-0000000000b1",
  detalle:
    "La orden OC-5004 de Transportes La Mesa entrega en 2 días (22/10) y está en Marcación",
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
      <ListaAvisosDeEntrega avisos={[]} hoy={HOY} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra la orden, el plazo de hoy y el texto del aviso", () => {
    render(<ListaAvisosDeEntrega avisos={[AVISO]} hoy={HOY} />);

    expect(screen.getByRole("region", { name: "Avisos" })).toBeInTheDocument();
    expect(screen.getByText("Entrega en 2 días · OC-5004")).toBeInTheDocument();
    expect(screen.getByText(AVISO.detalle)).toBeInTheDocument();
  });

  it("dice que se venció cuando la fecha ya pasó", () => {
    render(
      <ListaAvisosDeEntrega
        avisos={[{ ...AVISO, fechaEntrega: "2026-10-18" }]}
        hoy={HOY}
      />,
    );

    expect(
      screen.getByText("Se venció hace 2 días · OC-5004"),
    ).toBeInTheDocument();
  });

  it("«Ya lo vi» es un solo botón que manda solo el id del aviso", async () => {
    render(<ListaAvisosDeEntrega avisos={[AVISO]} hoy={HOY} />);

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
    render(<ListaAvisosDeEntrega avisos={[AVISO]} hoy={HOY} />);

    fireEvent.click(screen.getByRole("button", { name: "Ya lo vi" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este aviso es de otra persona.",
    );
  });
});
