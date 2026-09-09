import { z } from "zod";

/**
 * HU-16 · Validación del formulario de inicio de sesión.
 *
 * No hay mucho que validar más allá de la forma: si el correo o la contraseña
 * están mal, es Supabase quien lo sabe, no un esquema de zod. Esto solo evita
 * mandarle a Supabase un formulario vacío.
 */
export const iniciarSesionSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Escribe tu correo")
    .pipe(z.email("Escribe un correo válido")),
  password: z.string().min(1, "Escribe tu contraseña"),
});

export type EntradaIniciarSesion = z.infer<typeof iniciarSesionSchema>;
