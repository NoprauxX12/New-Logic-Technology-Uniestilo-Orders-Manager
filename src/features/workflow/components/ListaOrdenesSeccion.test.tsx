import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buscarCheckpoint } from "@/features/workflow/checkpoints";
import { ListaOrdenesSeccion } from "@/features/workflow/components/ListaOrdenesSeccion";
import type { OrdenParaSeccion } from "@/features/workflow/queries";

/**
 * La lista con la que una sección marca su etapa (HU-08 corte, HU-12
 * marcación). Una sola pantalla para todas: lo que cambia es el checkpoint.
 *
 * La action se sustituye porque importarla arrastra `server-only`. Aquí se
 * prueba qué se pinta según el veredicto del motor, no el envío.
 */

vi.mock("@/features/workflow/actions", () => ({
  marcarCheckpoint: vi.fn(),
}));

// `useRouter` exige el App Router montado; en jsdom no lo hay.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const { etiqueta } = buscarCheckpoint("corte_completado");

function orden(parcial: Partial<OrdenParaSeccion>): OrdenParaSeccion {
  return {
    id: "00000000-0000-0000-0000-0000000000f2",
    numeroOrdenCompra: "OC-5002",
    razonSocial: "Colegio San Ignacio",
    fechaEntrega: "2026-10-17",
    yaMarcada: false,
    fechaMarcado: null,
    veredicto: { permitido: true },
    ...parcial,
  };
}

describe("ListaOrdenesSeccion", () => {
  it("avisa cuando no hay órdenes", () => {
    render(<ListaOrdenesSeccion ordenes={[]} checkpoint="corte_completado" />);

    expect(screen.getByText(/no hay órdenes/i)).toBeInTheDocument();
  });

  it("ofrece marcar la etapa cuando el motor lo permite", () => {
    render(
      <ListaOrdenesSeccion
        ordenes={[orden({})]}
        checkpoint="corte_completado"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: new RegExp(`marcar ${etiqueta}`, "i"),
      }),
    ).toBeEnabled();
  });

  it("deshabilita el botón y dice por qué cuando el motor no deja", () => {
    render(
      <ListaOrdenesSeccion
        ordenes={[
          orden({
            veredicto: {
              permitido: false,
              motivo: "fuera_de_secuencia",
              mensaje: 'Antes hay que marcar "Tela programada".',
            },
          }),
        ]}
        checkpoint="corte_completado"
      />,
    );

    const boton = screen.getByRole("button", {
      name: new RegExp(`marcar ${etiqueta}`, "i"),
    });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/Tela programada/);
  });

  it("muestra la etapa como hecha en vez de un botón cuando ya se marcó", () => {
    render(
      <ListaOrdenesSeccion
        ordenes={[
          orden({ yaMarcada: true, fechaMarcado: "2026-10-01T10:00:00Z" }),
        ]}
        checkpoint="corte_completado"
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(new RegExp(etiqueta, "i"))).toBeInTheDocument();
  });
});
