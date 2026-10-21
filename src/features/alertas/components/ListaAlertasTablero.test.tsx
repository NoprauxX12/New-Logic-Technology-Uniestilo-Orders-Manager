import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListaAlertasTablero } from "@/features/alertas/components/ListaAlertasTablero";
import type { AlertaTelaEnTablero } from "@/features/alertas/queries";

vi.mock("@/features/alertas/actions", () => ({
  atenderAlertaDeTela: vi.fn(),
  atenderAvisoDeEntrega: vi.fn(),
}));

const ALERTA: AlertaTelaEnTablero = {
  tipo: "falta_tela",
  id: "00000000-0000-0000-0000-0000000000b1",
  detalle: "Faltan 40 metros de tela impermeable azul",
  fechaCreacion: "2026-10-16T15:00:00.000Z",
  numeroOrdenCompra: "OC-5002",
  razonSocial: "Clínica del Sur",
  enviadaPor: "Paula",
};

describe("ListaAlertasTablero", () => {
  it("no ocupa espacio si no hay alertas pendientes", () => {
    const { container } = render(<ListaAlertasTablero alertas={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra el aviso de secretaría y el botón para resolverlo", () => {
    render(<ListaAlertasTablero alertas={[ALERTA]} />);

    expect(
      screen.getByRole("region", { name: "Alertas de tela" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/falta tela en OC-5002/i)).toBeInTheDocument();
    expect(
      screen.getByText("Faltan 40 metros de tela impermeable azul"),
    ).toBeInTheDocument();
    expect(screen.getByText(/avisó Paula/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar como resuelta" }),
    ).toBeInTheDocument();
  });
});

describe("ListaAlertasTablero · avisos de entrega", () => {
  it("muestra el plazo vivo y no el detalle guardado, que pudo quedar viejo", () => {
    render(
      <ListaAlertasTablero
        ahora={new Date("2026-10-20T17:00:00Z")}
        alertas={[
          {
            tipo: "proximidad_entrega",
            id: "00000000-0000-0000-0000-0000000000b2",
            numeroOrdenCompra: "OC-5004",
            razonSocial: "Transportes La Mesa",
            fechaEntrega: "2026-10-20",
          },
        ]}
      />,
    );

    expect(screen.getByText("Entrega hoy · OC-5004")).toBeInTheDocument();
    expect(screen.queryByText(/entrega en 3 días/i)).toBeNull();
  });
});
