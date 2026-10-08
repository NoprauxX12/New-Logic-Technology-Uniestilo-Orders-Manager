import type { Rol } from "@/features/workflow/checkpoints";

/**
 * Las seis cuentas del seed (`supabase/seed.sql`), para el acceso rápido del
 * login en local. Si cambia el seed, cambia esto. La contraseña no está aquí:
 * la conoce solo la action, en el servidor.
 */
export type CuentaDemo = {
  nombre: string;
  email: string;
  rol: Rol;
};

export const CUENTAS_DEMO: readonly CuentaDemo[] = [
  { nombre: "Diana", email: "admin@uniestilo.test", rol: "admin" },
  { nombre: "Paula", email: "secretaria@uniestilo.test", rol: "secretaria" },
  { nombre: "Andrés", email: "diseno@uniestilo.test", rol: "diseno" },
  { nombre: "Jorge", email: "corte@uniestilo.test", rol: "corte" },
  { nombre: "Luis", email: "logistica@uniestilo.test", rol: "logistica" },
  { nombre: "Sandra", email: "marcacion@uniestilo.test", rol: "marcacion" },
];
