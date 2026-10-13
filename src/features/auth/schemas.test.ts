import { describe, expect, it } from "vitest";

import { iniciarSesionSchema } from "@/features/auth/schemas";

/**
 * HU-16 · Lo que entra a la action de login.
 *
 * No se prueba que el correo o la contraseña sean correctos: eso lo sabe
 * Supabase, no un esquema. Esto solo evita mandarle un formulario vacío.
 */

describe("iniciarSesionSchema · forma del formulario", () => {
  it("acepta un correo y una contraseña normales", () => {
    const resultado = iniciarSesionSchema.safeParse({
      email: "corte@uniestilo.test",
      password: "uniestilo123",
    });

    expect(resultado.success).toBe(true);
  });

  it("rechaza un correo sin arroba", () => {
    const resultado = iniciarSesionSchema.safeParse({
      email: "corte-uniestilo.test",
      password: "uniestilo123",
    });

    expect(resultado.success).toBe(false);
  });

  it("rechaza el correo vacío", () => {
    const resultado = iniciarSesionSchema.safeParse({
      email: "",
      password: "uniestilo123",
    });

    expect(resultado.success).toBe(false);
  });

  it("rechaza la contraseña vacía", () => {
    const resultado = iniciarSesionSchema.safeParse({
      email: "corte@uniestilo.test",
      password: "",
    });

    expect(resultado.success).toBe(false);
  });

  it("le quita los espacios al correo antes de validarlo", () => {
    const resultado = iniciarSesionSchema.safeParse({
      email: "  corte@uniestilo.test  ",
      password: "uniestilo123",
    });

    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.email).toBe("corte@uniestilo.test");
  });
});
