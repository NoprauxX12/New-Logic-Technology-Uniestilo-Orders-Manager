import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccesoRapido } from "@/features/auth/components/AccesoRapido";
import { CUENTAS_DEMO } from "@/features/auth/cuentasDemo";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";

/**
 * El acceso rápido del login: un botón por cuenta del seed, solo en local. La
 * página decide si se muestra; aquí se prueba qué ofrece cuando se muestra.
 */

vi.mock("@/features/auth/actions", () => ({
  iniciarSesionRapido: vi.fn(),
}));

describe("AccesoRapido", () => {
  it("ofrece una cuenta por rol del seed, con nombre y rol", () => {
    render(<AccesoRapido />);

    expect(CUENTAS_DEMO).toHaveLength(Object.keys(ETIQUETAS_ROL).length);
    for (const cuenta of CUENTAS_DEMO) {
      const boton = screen.getByRole("button", {
        name: new RegExp(`${cuenta.nombre}.*${ETIQUETAS_ROL[cuenta.rol]}`),
      });
      expect(boton).toBeInTheDocument();
    }
  });

  it("cada botón manda el correo de su cuenta en un campo oculto", () => {
    const { container } = render(<AccesoRapido />);

    const correos = [...container.querySelectorAll('input[name="email"]')].map(
      (input) => (input as HTMLInputElement).value,
    );

    expect(correos.sort()).toEqual(CUENTAS_DEMO.map((c) => c.email).sort());
  });

  it("dice que es solo para pruebas en local", () => {
    render(<AccesoRapido />);

    expect(screen.getByText(/solo en local/i)).toBeInTheDocument();
  });
});
