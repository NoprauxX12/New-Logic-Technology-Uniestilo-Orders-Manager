import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EstadoFormularioUsuario } from "@/features/usuarios/actions";
import { FormularioNuevoUsuario } from "@/features/usuarios/components/FormularioNuevoUsuario";
import { ENTRADA_VACIA } from "@/features/usuarios/formulario";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";

/**
 * HU-24 · El formulario con el que administración crea una cuenta. La action
 * se sustituye porque arrastra `server-only`; aquí se prueba qué manda y qué
 * pinta con la respuesta.
 */

const crearUsuario = vi.hoisted(() => vi.fn());

vi.mock("@/features/usuarios/actions", () => ({ crearUsuario }));

const ESTADO_OK: EstadoFormularioUsuario = {
  ok: true,
  mensaje: "Cuenta creada para Camila Ríos (Corte).",
  errores: {},
  valores: ENTRADA_VACIA,
};

function llenarYEnviar() {
  fireEvent.change(screen.getByLabelText("Nombre"), {
    target: { value: "Camila Ríos" },
  });
  fireEvent.change(screen.getByLabelText("Correo"), {
    target: { value: "camila@uniestilo.com.co" },
  });
  fireEvent.change(screen.getByLabelText("Rol"), {
    target: { value: "corte" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña inicial"), {
    target: { value: "Uniestilo2026" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
}

describe("FormularioNuevoUsuario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    crearUsuario.mockResolvedValue(ESTADO_OK);
  });

  it("ofrece los seis roles con su nombre de pantalla", () => {
    render(<FormularioNuevoUsuario />);

    for (const etiqueta of Object.values(ETIQUETAS_ROL)) {
      expect(
        screen.getByRole("option", { name: etiqueta }),
      ).toBeInTheDocument();
    }
  });

  it("manda los cuatro campos a la action", async () => {
    render(<FormularioNuevoUsuario />);

    llenarYEnviar();

    await waitFor(() => expect(crearUsuario).toHaveBeenCalledTimes(1));
    const [, formData] = crearUsuario.mock.calls[0] as [
      EstadoFormularioUsuario,
      FormData,
    ];
    expect(formData.get("nombre")).toBe("Camila Ríos");
    expect(formData.get("email")).toBe("camila@uniestilo.com.co");
    expect(formData.get("rol")).toBe("corte");
    expect(formData.get("password")).toBe("Uniestilo2026");
  });

  it("confirma la creación cuando la action responde que sí", async () => {
    render(<FormularioNuevoUsuario />);

    llenarYEnviar();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Cuenta creada para Camila Ríos",
    );
  });

  it("pinta el error del correo debajo de su campo", async () => {
    crearUsuario.mockResolvedValue({
      ok: false,
      mensaje: "",
      errores: { email: ["Ya hay una cuenta con ese correo"] },
      valores: { ...ENTRADA_VACIA, email: "camila@uniestilo.com.co" },
    } satisfies EstadoFormularioUsuario);

    render(<FormularioNuevoUsuario />);

    llenarYEnviar();

    expect(
      await screen.findByText("Ya hay una cuenta con ese correo"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo")).toHaveAccessibleDescription(
      /Ya hay una cuenta/,
    );
  });
});
