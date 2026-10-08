import { z } from "zod";

import { ETIQUETAS_ROL, type Rol } from "@/features/workflow/checkpoints";

/**
 * HU-24 · Validación de la cuenta que crea administración.
 *
 * Lo usan el formulario y la server action. Los roles válidos salen de la
 * fuente única (regla 4), no de una lista escrita aparte. El correo se guarda
 * en minúsculas porque es con lo que la persona va a entrar y Supabase Auth lo
 * compara así.
 */

const ROLES = Object.keys(ETIQUETAS_ROL) as [Rol, ...Rol[]];

/** Supabase exige 6; aquí se piden 8, que es lo mínimo razonable. */
export const LARGO_MINIMO_CONTRASENA = 8;

export const nuevoUsuarioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Escribe el nombre de la persona")
    .max(150, "El nombre es muy largo"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Escribe el correo con el que va a entrar")
    .pipe(z.email("Escribe un correo válido")),
  rol: z.enum(ROLES, { error: "Escoge el rol de la persona" }),
  password: z
    .string()
    .min(
      LARGO_MINIMO_CONTRASENA,
      `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres`,
    )
    .max(72, "La contraseña es muy larga"),
});

export type NuevoUsuario = z.infer<typeof nuevoUsuarioSchema>;
