import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListaOrdenesFicha } from "@/features/fichas/components/ListaOrdenesFicha";
import type { OrdenParaFicha } from "@/features/fichas/queries";

/**
 * HU-04 · Qué se pinta en la lista de diseño según si puede adjuntar o no.
 * La action se sustituye porque arrastra `server-only`.
 */

vi.mock("@/features/fichas/actions", () => ({
  adjuntarFichaTecnica: vi.fn(),
}));

function orden(parcial: Partial<OrdenParaFicha> = {}): OrdenParaFicha {
  return {
    id: "00000000-0000-0000-0000-0000000000f1",
    numeroOrdenCompra: "OC-5001",
    razonSocial: "Universidad EAFIT",
    fechaEntrega: "2026-10-17",
    yaMarcada: false,
    fechaMarcado: null,
    veredicto: { permitido: true },
    fichas: [],
    puedeAdjuntar: true,
    ...parcial,
  };
}

describe("ListaOrdenesFicha", () => {
  it("avisa cuando no hay órdenes", () => {
    render(<ListaOrdenesFicha ordenes={[]} />);

    expect(screen.getByText(/no hay órdenes/i)).toBeInTheDocument();
  });

  it("ofrece adjuntar cuando diseño puede hacerlo", () => {
    render(<ListaOrdenesFicha ordenes={[orden()]} />);

    expect(
      screen.getByRole("button", { name: /adjuntar ficha técnica/i }),
    ).toBeEnabled();
    expect(screen.getByLabelText(/archivo de la ficha técnica/i)).toBeEnabled();
  });

  it("deshabilita el botón y dice por qué cuando el motor no deja", () => {
    render(
      <ListaOrdenesFicha
        ordenes={[
          orden({
            puedeAdjuntar: false,
            veredicto: {
              permitido: false,
              motivo: "rol_no_autorizado",
              mensaje: "La ficha técnica la adjunta Diseño.",
            },
          }),
        ]}
      />,
    );

    const boton = screen.getByRole("button", {
      name: /adjuntar ficha técnica/i,
    });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/la adjunta Diseño/i);
  });

  it("muestra la ficha ya subida para que el equipo la abra", () => {
    render(
      <ListaOrdenesFicha
        ordenes={[
          orden({
            yaMarcada: true,
            puedeAdjuntar: true,
            fichas: [
              {
                id: "ficha-1",
                nombre: "ficha-polo-verde.pdf",
                url: "https://example.com/ficha.pdf",
                subidaPor: "Camila Diseño",
                fechaSubida: "2026-09-01T10:00:00Z",
              },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText(/ficha técnica adjunta/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ver ficha-polo-verde\.pdf/i }),
    ).toHaveAttribute("href", "https://example.com/ficha.pdf");
    expect(
      screen.getByRole("button", { name: /adjuntar ficha técnica/i }),
    ).toBeEnabled();
  });
});
