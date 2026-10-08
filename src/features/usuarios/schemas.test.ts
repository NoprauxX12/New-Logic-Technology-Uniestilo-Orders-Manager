import { describe, expect, it } from "vitest";
import { z } from "zod";

import { nuevoUsuarioSchema } from "@/features/usuarios/schemas";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";

/**
 * HU-24 · Lo que administración escribe para crear una cuenta: nombre, correo,
 * rol y contraseña inicial. Los roles válidos salen de la fuente única.
 */

const VALIDO = {
  nombre: "Camila Ríos",
  email: "camila@uniestilo.com.co",
  rol: "corte",
  password: "Uniestilo2026",
};

function erroresDe(entrada: unknown): Record<string, string[] | undefined> {
  const resultado = nuevoUsuarioSchema.safeParse(entrada);
  if (resultado.success) return {};
  return z.flattenError(resultado.error).fieldErrors as Record<
    string,
    string[] | undefined
  >;
}

describe("nuevoUsuarioSchema", () => {
  it("acepta una persona completa", () => {
    expect(nuevoUsuarioSchema.safeParse(VALIDO).success).toBe(true);
  });

  it("acepta todos los roles del modelo y ningún otro", () => {
    for (const rol of Object.keys(ETIQUETAS_ROL)) {
      expect(nuevoUsuarioSchema.safeParse({ ...VALIDO, rol }).success).toBe(
        true,
      );
    }
    expect(erroresDe({ ...VALIDO, rol: "gerente" }).rol).toBeDefined();
  });

  it("pide el nombre y le quita los espacios", () => {
    expect(erroresDe({ ...VALIDO, nombre: "   " }).nombre).toContain(
      "Escribe el nombre de la persona",
    );
    const resultado = nuevoUsuarioSchema.safeParse({
      ...VALIDO,
      nombre: "  Camila Ríos  ",
    });
    expect(resultado.success && resultado.data.nombre).toBe("Camila Ríos");
  });

  it("pide un correo válido y lo guarda en minúsculas", () => {
    expect(erroresDe({ ...VALIDO, email: "camila" }).email).toBeDefined();
    const resultado = nuevoUsuarioSchema.safeParse({
      ...VALIDO,
      email: " Camila@Uniestilo.com.co ",
    });
    expect(resultado.success && resultado.data.email).toBe(
      "camila@uniestilo.com.co",
    );
  });

  it("exige una contraseña de al menos 8 caracteres", () => {
    expect(erroresDe({ ...VALIDO, password: "corto1" }).password).toContain(
      "La contraseña debe tener al menos 8 caracteres",
    );
  });
});
