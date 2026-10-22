/**
 * Las cuentas del seed local (`supabase/seed.sql`). La contraseña es pública
 * y solo existe en local: `exigirEntornoLocal()` impide usarla en otro lado.
 */

export const CONTRASENA_DEL_SEED = "uniestilo123";

export type Cuenta = {
  correo: string;
  contrasena: string;
  /** Como se saluda en el inicio: «Hola, Diana Restrepo». */
  nombre: string;
};

export const CUENTAS = {
  admin: {
    correo: "admin@uniestilo.test",
    contrasena: CONTRASENA_DEL_SEED,
    nombre: "Diana Restrepo",
  },
} as const satisfies Record<string, Cuenta>;
