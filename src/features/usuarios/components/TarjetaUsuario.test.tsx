import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TarjetaUsuario } from "@/features/usuarios/components/TarjetaUsuario";
import type { UsuarioListado } from "@/features/usuarios/queries";

/**
 * HU-24 · La tarjeta de una persona: lo que administración puede hacerle.
 * Las actions se sustituyen; aquí se prueba qué se ofrece y qué se esconde.
 */

vi.mock("@/features/usuarios/actions", () => ({
  editarUsuario: vi.fn(),
  cambiarContrasena: vi.fn(),
  cambiarEstadoUsuario: vi.fn(),
  borrarUsuario: vi.fn(),
}));

const YO = "00000000-0000-0000-0000-0000000000a1";

function persona(parcial: Partial<UsuarioListado> = {}): UsuarioListado {
  return {
    id: "00000000-0000-0000-0000-0000000000a4",
    nombre: "Jorge Cardona",
    email: "corte@uniestilo.test",
    rol: "corte",
    activo: true,
    creadoEn: "2026-09-09T00:00:00Z",
    ...parcial,
  };
}

describe("TarjetaUsuario", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra nombre, correo y rol, y las acciones cerradas", () => {
    render(<TarjetaUsuario usuario={persona()} quienId={YO} />);

    expect(screen.getByText("Jorge Cardona")).toBeInTheDocument();
    expect(screen.getByText("corte@uniestilo.test")).toBeInTheDocument();
    expect(screen.getByText("Corte")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).toBeNull();
  });

  it("al pulsar Editar abre el formulario con los datos actuales", () => {
    render(<TarjetaUsuario usuario={persona()} quienId={YO} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByLabelText("Nombre")).toHaveValue("Jorge Cardona");
    expect(screen.getByLabelText("Correo")).toHaveValue("corte@uniestilo.test");
    expect(screen.getByLabelText("Rol")).toHaveValue("corte");
    expect(screen.getByLabelText("Nueva contraseña")).toBeInTheDocument();
  });

  it("borrar pide confirmación antes de mandar la action", () => {
    render(<TarjetaUsuario usuario={persona()} quienId={YO} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Borrar cuenta" }));

    expect(
      screen.getByRole("button", { name: /sí, borrar/i }),
    ).toBeInTheDocument();
  });

  it("una cuenta inactiva se marca y ofrece reactivar en vez de desactivar", () => {
    render(
      <TarjetaUsuario usuario={persona({ activo: false })} quienId={YO} />,
    );

    expect(screen.getByText("Inactiva")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(
      screen.getByRole("button", { name: "Reactivar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desactivar" })).toBeNull();
  });

  it("sobre mi propia cuenta no ofrece cambiar rol, desactivar ni borrar", () => {
    render(
      <TarjetaUsuario
        usuario={persona({ id: YO, nombre: "Diana", rol: "admin" })}
        quienId={YO}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByLabelText("Rol")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Desactivar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar cuenta" })).toBeNull();
    expect(screen.getByText(/tu propia cuenta/i)).toBeInTheDocument();
  });
});
