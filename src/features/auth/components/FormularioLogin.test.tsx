import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FormularioLogin } from "@/features/auth/components/FormularioLogin";

/**
 * Lo que ve quien abre `/login` (HU-16).
 *
 * La action se sustituye porque importarla arrastra `@/lib/supabase/server`,
 * que lleva `server-only` y revienta fuera del servidor. Aquí no se prueba el
 * envío del formulario —eso es un flujo completo, y va a Playwright—, sino lo
 * que hay en pantalla al abrirlo.
 */
vi.mock("@/features/auth/actions", () => ({
  iniciarSesion: vi.fn(),
}));

describe("FormularioLogin · lo que se ve al abrir la pantalla", () => {
  it("pide el correo y la contraseña, y el botón dice Entrar", () => {
    render(<FormularioLogin next="/" />);

    expect(screen.getByRole("textbox", { name: "Correo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("no muestra ningún error al abrir el formulario", () => {
    render(<FormularioLogin next="/" />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lleva adónde volver tras entrar, en un campo oculto", () => {
    const { container } = render(<FormularioLogin next="/ordenes/corte" />);
    const oculto = container.querySelector('input[name="next"]');

    expect(oculto).toHaveValue("/ordenes/corte");
  });
});
