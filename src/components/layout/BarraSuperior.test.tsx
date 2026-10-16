import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BarraSuperior } from "@/components/layout/BarraSuperior";

/**
 * La barra de arriba lleva el logo de Uniestilo como enlace al inicio, además
 * de quién está dentro y el botón de salir.
 */

vi.mock("@/features/auth/actions", () => ({ cerrarSesion: vi.fn() }));

const USUARIO = { id: "a1", nombre: "Diana Restrepo", rol: "admin" as const };

describe("BarraSuperior", () => {
  it("muestra el logo de Uniestilo enlazado al inicio", () => {
    render(<BarraSuperior usuario={USUARIO} />);

    const logo = screen.getByRole("img", { name: /uniestilo/i });
    expect(logo).toBeInTheDocument();
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("muestra la persona, su rol y cerrar sesión", () => {
    render(<BarraSuperior usuario={USUARIO} />);

    expect(screen.getByText("Diana Restrepo")).toBeInTheDocument();
    expect(screen.getByText(/Administración/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });
});
