import { CHECKPOINTS, type Rol } from "@/features/workflow/checkpoints";

/**
 * HU-17 · Qué pantallas puede abrir cada rol.
 *
 * Es la fuente única del acceso por pantalla. La parte que depende del flujo
 * sale de `checkpoints.ts` (regla 4): la pantalla donde se marca una etapa es
 * de su rol dueño. Lo demás —tablero, registro, órdenes para taller— se
 * declara aquí. Administración entra a todo, porque es quien ve la totalidad
 * de las órdenes y de las etapas.
 *
 * Es una función pura sin `server-only`: la usa la guardia de las páginas y
 * se prueba sin levantar nada. La base repite el control con RLS; esto decide
 * qué pantalla se muestra, no qué se puede escribir.
 */

const ADMIN: Rol = "admin";

/** Se ven sin sesión: el proxy ya las deja pasar. */
const RUTAS_PUBLICAS = new Set(["/", "/login"]);

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

type Regla = {
  coincide: (ruta: string) => boolean;
  roles: readonly Rol[];
};

function exacta(ruta: string, roles: readonly Rol[]): Regla {
  return { coincide: (candidata) => candidata === ruta, roles };
}

function conId(prefijo: string, roles: readonly Rol[]): Regla {
  const patron = new RegExp(`^${prefijo}/${UUID}$`, "i");
  return { coincide: (candidata) => patron.test(candidata), roles };
}

const REGLAS: readonly Regla[] = [
  // HU-14: el tablero y la trazabilidad de una orden son de administración.
  exacta("/tablero", [ADMIN]),
  conId("/tablero", [ADMIN]),
  // HU-01: registrar órdenes es de administración.
  exacta("/ordenes/nueva", [ADMIN]),
  // HU-24: crear cuentas es de administración.
  exacta("/usuarios", [ADMIN]),
  // HU-10 y HU-11: logística despacha y recibe desde el detalle de la orden.
  exacta("/ordenes/talleres", ["logistica", ADMIN]),
  conId("/ordenes", ["logistica", ADMIN]),
  // La pantalla de cada etapa es de su rol dueño.
  ...CHECKPOINTS.flatMap((checkpoint) =>
    checkpoint.ruta
      ? [exacta(checkpoint.ruta, [checkpoint.rolDueno, ADMIN])]
      : [],
  ),
];

/** Los roles que pueden abrir esa ruta. Vacío si la ruta no está en el mapa. */
export function rolesDeRuta(ruta: string): Rol[] {
  const roles = new Set<Rol>();
  for (const regla of REGLAS) {
    if (regla.coincide(ruta)) regla.roles.forEach((rol) => roles.add(rol));
  }
  return [...roles];
}

/** ¿Puede este rol abrir esta ruta? */
export function puedeEntrar(rol: Rol, ruta: string): boolean {
  if (RUTAS_PUBLICAS.has(ruta)) return true;
  return rolesDeRuta(ruta).includes(rol);
}
