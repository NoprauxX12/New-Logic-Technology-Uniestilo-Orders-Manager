import { describe, expect, it } from "vitest";

import { puedeEntrar, rolesDeRuta } from "@/features/auth/accesoPorRuta";
import {
  CHECKPOINTS,
  ETIQUETAS_ROL,
  type Rol,
} from "@/features/workflow/checkpoints";

/**
 * HU-17 · Qué pantallas puede abrir cada rol.
 *
 * El mapa sale de `checkpoints.ts` (regla 4): la pantalla donde se marca una
 * etapa es de su rol dueño. Administración entra a todo, porque es quien ve la
 * totalidad de las órdenes y de las etapas.
 */

const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];
const ORDEN = "/ordenes/00000000-0000-0000-0000-0000000000f3";

describe("rolesDeRuta · derivado de checkpoints.ts", () => {
  it("la pantalla de cada etapa es de su rol dueño", () => {
    for (const checkpoint of CHECKPOINTS) {
      if (!checkpoint.ruta) continue;
      expect(rolesDeRuta(checkpoint.ruta)).toContain(checkpoint.rolDueno);
    }
  });

  it("administración entra a todas las pantallas con sesión", () => {
    const rutas = [
      "/tablero",
      "/tablero/00000000-0000-0000-0000-0000000000f3",
      "/ordenes/nueva",
      "/ordenes/talleres",
      "/usuarios",
      ORDEN,
      ...CHECKPOINTS.flatMap((c) => (c.ruta ? [c.ruta] : [])),
    ];

    for (const ruta of rutas) {
      expect(puedeEntrar("admin", ruta)).toBe(true);
    }
  });
});

describe("puedeEntrar · lo de cada sección", () => {
  it("diseño entra a su pantalla y no al tablero", () => {
    expect(puedeEntrar("diseno", "/ordenes/diseno")).toBe(true);
    expect(puedeEntrar("diseno", "/ordenes/corte")).toBe(false);
    expect(puedeEntrar("diseno", "/tablero")).toBe(false);
  });

  it("corte entra a su pantalla y a nada más", () => {
    expect(puedeEntrar("corte", "/ordenes/corte")).toBe(true);
    expect(puedeEntrar("corte", "/ordenes/marcacion")).toBe(false);
    expect(puedeEntrar("corte", "/ordenes/cierre")).toBe(false);
    expect(puedeEntrar("corte", "/tablero")).toBe(false);
    expect(puedeEntrar("corte", "/ordenes/nueva")).toBe(false);
  });

  it("terminación entra a marcación y a despacho: son un solo rol", () => {
    expect(puedeEntrar("terminacion", "/ordenes/marcacion")).toBe(true);
    expect(puedeEntrar("terminacion", "/ordenes/despacho")).toBe(true);
    expect(puedeEntrar("terminacion", "/ordenes/corte")).toBe(false);
  });

  it("el rol marcación ya no existe", () => {
    expect(ROLES).not.toContain("marcacion");
  });

  it("todos los roles abren el detalle de una orden, que es de lectura", () => {
    for (const rol of ROLES) {
      expect(puedeEntrar(rol, ORDEN)).toBe(true);
    }
  });

  it("secretaría entra a la programación y al cierre", () => {
    expect(puedeEntrar("secretaria", "/ordenes/programacion")).toBe(true);
    expect(puedeEntrar("secretaria", "/ordenes/cierre")).toBe(true);
    expect(puedeEntrar("secretaria", "/tablero")).toBe(false);
  });

  it("solo secretaría y administración entran a las cotizaciones (HU-02)", () => {
    for (const rol of ROLES) {
      expect(puedeEntrar(rol, "/ordenes/cotizacion")).toBe(
        rol === "secretaria" || rol === "admin",
      );
    }
  });

  it("la programación no la abre ninguna otra sección (HU-03)", () => {
    for (const rol of ROLES) {
      expect(puedeEntrar(rol, "/ordenes/programacion")).toBe(
        rol === "secretaria" || rol === "admin",
      );
    }
  });

  it("solo secretaría y administración entran a validar telas (HU-06)", () => {
    for (const rol of ROLES) {
      expect(puedeEntrar(rol, "/ordenes/telas")).toBe(
        rol === "secretaria" || rol === "admin",
      );
    }
  });

  it("solo secretaría y administración validan insumos y ven el listado (HU-23)", () => {
    for (const rol of ROLES) {
      const esperado = rol === "secretaria" || rol === "admin";
      expect(puedeEntrar(rol, "/ordenes/insumos")).toBe(esperado);
      expect(
        puedeEntrar(
          rol,
          "/ordenes/insumos/00000000-0000-0000-0000-0000000000f2",
        ),
      ).toBe(esperado);
    }
  });

  it("el listado de insumos exige un id de orden válido (HU-23)", () => {
    expect(puedeEntrar("secretaria", "/ordenes/insumos/no-es-un-id")).toBe(
      false,
    );
  });

  it("logística entra a sus órdenes y al detalle de una orden", () => {
    expect(puedeEntrar("logistica", "/ordenes/talleres")).toBe(true);
    expect(puedeEntrar("logistica", ORDEN)).toBe(true);
    expect(puedeEntrar("logistica", "/ordenes/cierre")).toBe(false);
  });

  it("solo administración ve el tablero, registra órdenes y crea cuentas", () => {
    for (const rol of ROLES) {
      expect(puedeEntrar(rol, "/tablero")).toBe(rol === "admin");
      expect(puedeEntrar(rol, "/ordenes/nueva")).toBe(rol === "admin");
      expect(puedeEntrar(rol, "/usuarios")).toBe(rol === "admin");
    }
  });

  it("una ruta que no está en el mapa no la abre nadie, ni administración", () => {
    for (const rol of ROLES) {
      expect(puedeEntrar(rol, "/ordenes/inventario")).toBe(false);
    }
  });

  it("editar una orden es solo de administración", () => {
    const editar = `${ORDEN}/editar`;

    for (const rol of ROLES) {
      expect(puedeEntrar(rol, editar)).toBe(rol === "admin");
    }
  });

  it("la portada y el login son de todos", () => {
    for (const rol of ROLES) {
      expect(puedeEntrar(rol, "/")).toBe(true);
      expect(puedeEntrar(rol, "/login")).toBe(true);
    }
  });
});
