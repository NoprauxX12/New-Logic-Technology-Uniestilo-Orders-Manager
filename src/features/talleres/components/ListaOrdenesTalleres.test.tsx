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
    lotesTotales: 0,
    lotesSinRecibir: 0,
    enTallerDesde: null,
    ...parcial,
  };
}

describe("ListaOrdenesTalleres", () => {
  it("avisa cuando no hay órdenes listas para el taller", () => {
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

/**
 * La lista se parte en las tres tareas de logística: mandar al taller, esperar
 * que vuelva, y lo que ya volvió (plegado).
 */
describe("ListaOrdenesTalleres · grupos", () => {
  const afuera = (desde: string): Partial<OrdenParaTalleres> => ({
    lotesTotales: 1,
    lotesSinRecibir: 1,
    enTallerDesde: desde,
  });

  it("separa por despachar, en el taller y ya volvieron, con su conteo", () => {
    render(
      <ListaOrdenesTalleres
        ordenes={[
          orden({ id: "a", numeroOrdenCompra: "OC-NUEVA" }),
          orden({
            id: "b",
            numeroOrdenCompra: "OC-AFUERA",
            ...afuera(new Date().toISOString()),
          }),
          orden({
            id: "c",
            numeroOrdenCompra: "OC-VOLVIO",
            lotesTotales: 1,
            lotesSinRecibir: 0,
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /Por despachar a un taller \(1\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /En el taller, por recibir \(1\)/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ya volvieron del taller (1)").closest("details"),
    ).not.toHaveAttribute("open");
  });

  it("en el taller dice cuántos días lleva afuera cada orden", () => {
    const haceCuatroDias = new Date(
      Date.now() - 4 * 24 * 3600_000,
    ).toISOString();

    render(
      <ListaOrdenesTalleres ordenes={[orden({ ...afuera(haceCuatroDias) })]} />,
    );

    expect(screen.getByText("Lleva 4 días en el taller")).toBeInTheDocument();
  });

  it("pone primero la orden que lleva más días en el taller", () => {
    const hace = (dias: number) =>
      new Date(Date.now() - dias * 24 * 3600_000).toISOString();

    render(
      <ListaOrdenesTalleres
        ordenes={[
          orden({
            id: "r",
            numeroOrdenCompra: "OC-RECIENTE",
            ...afuera(hace(1)),
          }),
          orden({ id: "v", numeroOrdenCompra: "OC-VIEJA", ...afuera(hace(9)) }),
        ]}
      />,
    );

    const titulos = screen
      .getAllByRole("heading", { level: 3 })
      .map((encabezado) => encabezado.textContent);

    expect(titulos).toEqual(["OC-VIEJA", "OC-RECIENTE"]);
  });

  it("un grupo sin órdenes lo dice en vez de desaparecer", () => {
    render(<ListaOrdenesTalleres ordenes={[orden({})]} />);

    expect(
      screen.getByText("No hay lotes esperando en un taller."),
    ).toBeInTheDocument();
  });
});
