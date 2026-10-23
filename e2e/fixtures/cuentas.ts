/**
 * Las cuentas del seed local (`supabase/seed.sql`), una por rol. La contraseña es
 * pública y solo existe en local: `exigirEntornoLocal()` impide usarla en otro
 * lado.
 */

export const CONTRASENA_DEL_SEED = "uniestilo123";

export type Cuenta = {
  correo: string;
  contrasena: string;
  /** Como se saluda en el inicio: «Hola, Diana Restrepo». */
  nombre: string;
  /** Como se muestra el rol junto a quien marcó una etapa: «(Secretaría)». */
  rol: string;
};

export const CUENTAS = {
  admin: {
    correo: "admin@uniestilo.test",
    contrasena: CONTRASENA_DEL_SEED,
    nombre: "Diana Restrepo",
    rol: "Administración",
  },
  secretaria: {
    correo: "secretaria@uniestilo.test",
    contrasena: CONTRASENA_DEL_SEED,
    nombre: "Paula Henao",
    rol: "Secretaría",
  },
  diseno: {
    correo: "diseno@uniestilo.test",
    contrasena: CONTRASENA_DEL_SEED,
    nombre: "Andrés Mejía",
    rol: "Diseño",
  },
  corte: {
    correo: "corte@uniestilo.test",
    contrasena: CONTRASENA_DEL_SEED,
    nombre: "Jorge Cardona",
    rol: "Corte",
  },
  logistica: {
    correo: "logistica@uniestilo.test",
    contrasena: CONTRASENA_DEL_SEED,
    nombre: "Luis Betancur",
    rol: "Logística",
  },
  marcacion: {
    correo: "marcacion@uniestilo.test",
    contrasena: CONTRASENA_DEL_SEED,
    nombre: "Sandra Vélez",
    rol: "Marcación",
  },
  terminacion: {
    correo: "terminacion@uniestilo.test",
    contrasena: CONTRASENA_DEL_SEED,
    nombre: "Marcela Osorio",
    rol: "Terminación",
  },
} as const satisfies Record<string, Cuenta>;
