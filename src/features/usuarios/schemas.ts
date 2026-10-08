import { z } from "zod";

import { ETIQUETAS_ROL, type Rol } from "@/features/workflow/checkpoints";

/**
 * HU-24 · Validación de lo que administración escribe sobre una cuenta.
 *
 * Lo usan el formulario y la server action. Los roles válidos salen de la
 * fuente única (regla 4), no de una lista escrita aparte. El correo se guarda
 * en minúsculas porque es con lo que la persona va a entrar y Supabase Auth lo
 * compara así.
 */

const ROLES = Object.keys(ETIQUETAS_ROL) as [Rol, ...Rol[]];

/** Supabase exige 6; aquí se piden 8, que es lo mínimo razonable. */
export const LARGO_MINIMO_CONTRASENA = 8;

const nombre = z
  .string()
  .trim()
  .min(1, "Escribe el nombre de la persona")
  .max(150, "El nombre es muy largo");

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Escribe el correo con el que va a entrar")
  .pipe(z.email("Escribe un correo válido"));

const rol = z.enum(ROLES, { error: "Escoge el rol de la persona" });

const password = z
  .string()
  .min(
    LARGO_MINIMO_CONTRASENA,
    `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres`,
  )
  .max(72, "La contraseña es muy larga");

// `guid` y no `uuid`: los ids del seed no cumplen la versión de la RFC.
const id = z.guid({ error: "No se sabe de qué persona se trata" });

export const nuevoUsuarioSchema = z.object({ nombre, email, rol, password });

export const editarUsuarioSchema = z.object({ id, nombre, email, rol });

export const cambiarContrasenaSchema = z.object({ id, password });

export const idUsuarioSchema = z.object({ id });

export type NuevoUsuario = z.infer<typeof nuevoUsuarioSchema>;
export type EdicionUsuario = z.infer<typeof editarUsuarioSchema>;
