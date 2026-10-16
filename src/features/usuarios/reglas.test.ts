import { describe, expect, it } from "vitest";

import { puedeAdministrar } from "@/features/usuarios/reglas";

/**
 * HU-24 · Quién puede hacer qué sobre una cuenta.
 *
 * Solo administración administra cuentas, y hay tres cosas que no puede
 * hacerse a sí misma: cambiarse el rol, desactivarse y borrarse. Sin eso, el
 * único admin del taller podría dejarse por fuera del sistema.
 */

const ADMIN = { id: "a1", rol: "admin" as const };
const OTRA = "a4";

describe("puedeAdministrar · rol", () => {
  it("solo administración administra cuentas", () => {
    for (const rol of ["secretaria", "corte", "logistica"] as const) {
      const resultado = puedeAdministrar({
        quien: { id: "x", rol },
        objetivoId: OTRA,
        accion: "editar",
      });
      expect(resultado.permitido).toBe(false);
      expect(resultado.permitido === false && resultado.mensaje).toContain(
        "administración",
      );
    }
  });
});

describe("puedeAdministrar · sobre otra persona", () => {
  it.each([
    "editar",
    "cambiar_rol",
    "cambiar_contrasena",
    "desactivar",
    "borrar",
  ] as const)("administración puede %s a otra persona", (accion) => {
    expect(
      puedeAdministrar({ quien: ADMIN, objetivoId: OTRA, accion }),
    ).toEqual({ permitido: true });
  });
});

describe("puedeAdministrar · sobre sí misma", () => {
  it("puede corregir su nombre o correo y cambiar su contraseña", () => {
    for (const accion of ["editar", "cambiar_contrasena"] as const) {
      expect(
        puedeAdministrar({ quien: ADMIN, objetivoId: ADMIN.id, accion }),
      ).toEqual({ permitido: true });
    }
  });

  it.each(["cambiar_rol", "desactivar", "borrar"] as const)(
    "no puede %s su propia cuenta, y el mensaje lo dice",
    (accion) => {
      const resultado = puedeAdministrar({
        quien: ADMIN,
        objetivoId: ADMIN.id,
        accion,
      });

      expect(resultado.permitido).toBe(false);
      expect(resultado.permitido === false && resultado.mensaje).toMatch(
        /tu propia cuenta/i,
      );
    },
  );
});
