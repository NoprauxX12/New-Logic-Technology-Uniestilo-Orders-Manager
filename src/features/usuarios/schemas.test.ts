import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  cambiarContrasenaSchema,
  editarUsuarioSchema,
  idUsuarioSchema,
  nuevoUsuarioSchema,
} from "@/features/usuarios/schemas";
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

const ID = "00000000-0000-0000-0000-0000000000a4";

describe("editarUsuarioSchema", () => {
  it("acepta la persona con su id, sin contraseña", () => {
    const resultado = editarUsuarioSchema.safeParse({
      id: ID,
      nombre: "Jorge Cardona",
      email: "Jorge@Uniestilo.test",
      rol: "corte",
    });

    expect(resultado.success).toBe(true);
    expect(resultado.success && resultado.data.email).toBe(
      "jorge@uniestilo.test",
    );
  });

  it("rechaza un id que no es identificador", () => {
    const resultado = editarUsuarioSchema.safeParse({
      id: "jorge",
      nombre: "Jorge",
      email: "jorge@uniestilo.test",
      rol: "corte",
    });

    expect(resultado.success).toBe(false);
  });
});

describe("cambiarContrasenaSchema", () => {
  it("exige la misma longitud mínima que al crear", () => {
    expect(
      cambiarContrasenaSchema.safeParse({ id: ID, password: "corto1" }).success,
    ).toBe(false);
    expect(
      cambiarContrasenaSchema.safeParse({ id: ID, password: "Uniestilo2026" })
        .success,
    ).toBe(true);
  });
});

describe("idUsuarioSchema", () => {
  it("solo necesita el id de la persona", () => {
    expect(idUsuarioSchema.safeParse({ id: ID }).success).toBe(true);
    expect(idUsuarioSchema.safeParse({ id: "" }).success).toBe(false);
  });
});
