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
  it("corte entra a su pantalla y a nada más", () => {
    expect(puedeEntrar("corte", "/ordenes/corte")).toBe(true);
    expect(puedeEntrar("corte", "/ordenes/marcacion")).toBe(false);
    expect(puedeEntrar("corte", "/ordenes/cierre")).toBe(false);
    expect(puedeEntrar("corte", "/tablero")).toBe(false);
    expect(puedeEntrar("corte", "/ordenes/nueva")).toBe(false);
    expect(puedeEntrar("corte", ORDEN)).toBe(false);
  });

  it("marcación entra a su pantalla", () => {
    expect(puedeEntrar("marcacion", "/ordenes/marcacion")).toBe(true);
    expect(puedeEntrar("marcacion", "/ordenes/corte")).toBe(false);
  });

  it("secretaría entra al cierre", () => {
    expect(puedeEntrar("secretaria", "/ordenes/cierre")).toBe(true);
    expect(puedeEntrar("secretaria", "/tablero")).toBe(false);
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

  it("la portada y el login son de todos", () => {
    for (const rol of ROLES) {
      expect(puedeEntrar(rol, "/")).toBe(true);
      expect(puedeEntrar(rol, "/login")).toBe(true);
    }
  });
});
