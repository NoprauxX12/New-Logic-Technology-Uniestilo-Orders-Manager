import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ListaOrdenesTalleres } from "@/features/talleres/components/ListaOrdenesTalleres";
import type { OrdenParaTalleres } from "@/features/talleres/queries";

/**
 * HU-10 y HU-11 · La lista desde la que logística entra a cada orden para
 * despachar o recibir lotes. Antes llegaba por el tablero, que con HU-17 pasa
 * a ser solo de administración.
 */

function orden(parcial: Partial<OrdenParaTalleres>): OrdenParaTalleres {
  return {
    id: "00000000-0000-0000-0000-0000000000f3",
    numeroOrdenCompra: "OC-5003",
    razonSocial: "Transportes La Mesa S.A.S.",
    fechaEntrega: "2026-10-11",
    estadoTalleres: "En confección.",
    ...parcial,
  };
}

describe("ListaOrdenesTalleres", () => {
  it("avisa cuando no hay órdenes con el corte hecho", () => {
    render(<ListaOrdenesTalleres ordenes={[]} />);

    expect(screen.getByText(/no hay órdenes/i)).toBeInTheDocument();
  });

  it("enlaza cada orden a su detalle, donde se despacha y se recibe", () => {
    render(<ListaOrdenesTalleres ordenes={[orden({})]} />);

    expect(screen.getByRole("link", { name: /OC-5003/ })).toHaveAttribute(
      "href",
      "/ordenes/00000000-0000-0000-0000-0000000000f3",
    );
  });

  it("muestra el estado de los lotes de cada orden", () => {
    render(
      <ListaOrdenesTalleres
        ordenes={[
          orden({ estadoTalleres: "Todo el trabajo volvió del taller." }),
        ]}
      />,
    );

    expect(
      screen.getByText("Todo el trabajo volvió del taller."),
    ).toBeInTheDocument();
  });
});
