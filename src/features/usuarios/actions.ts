"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ENTRADA_VACIA,
  leerFormularioUsuario,
  type EntradaUsuario,
} from "@/features/usuarios/formulario";
import { obtenerUsuario } from "@/features/usuarios/queries";
import {
  puedeAdministrar,
  type AccionSobreCuenta,
} from "@/features/usuarios/reglas";
import {
  cambiarContrasenaSchema,
  editarUsuarioSchema,
  idUsuarioSchema,
  nuevoUsuarioSchema,
} from "@/features/usuarios/schemas";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";
import { getUsuarioActual, type UsuarioActual } from "@/lib/auth/usuarioActual";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * HU-24 · Administrar las cuentas de las personas del taller.
 *
 * Solo administración. Una cuenta vive en dos lados: Supabase Auth (correo,
 * contraseña, bloqueo) y `usuario` (nombre, rol, activo). Lo de Auth se cambia
 * con la API de administración y la secret key, porque no es SQL de la
 * aplicación; lo de `usuario` se escribe con la sesión del administrador, para
 * que las políticas RLS vuelvan a comprobar el rol en la base (ADR 0008).
 *
 * Como no hay transacción que abarque los dos lados, cada action escribe
 * primero en `usuario` (que es donde RLS puede decir que no) y después en Auth,
 * y si Auth falla deshace lo de `usuario`.
 *
 * Reglas que viven en `reglas.ts`: solo admin, y nadie se cambia el rol, se
 * desactiva ni se borra a sí mismo.
 */

export type EstadoFormularioUsuario = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[] | undefined>;
  /** Lo escrito, para volver a pintarlo si hubo error. Nunca la contraseña. */
  valores: EntradaUsuario;
};

/** Lo que devuelven las acciones de una cuenta ya existente. */
export type ResultadoCuenta = {
  ok: boolean;
  mensaje: string;
  errores: Record<string, string[] | undefined>;
};

/** Violación de unicidad en `usuario.email`. */
const DUPLICADO = "23505";
/** Alguien referencia a la persona: tiene rastro en la bitácora. */
const TIENE_RASTRO = "23503";
/** RLS rechazó la fila. */
const RLS_RECHAZO = "42501";

/** Un bloqueo "indefinido" para Supabase Auth: cien años. */
const BLOQUEO_INDEFINIDO = "876000h";

function soloEntrada(escrito: ReturnType<typeof leerFormularioUsuario>) {
  const { nombre, email, rol } = escrito;
  return { nombre, email, rol };
}

function fallo(mensaje: string, errores = {}): ResultadoCuenta {
  return { ok: false, mensaje, errores };
}

function primerError(error: z.ZodError, porDefecto: string): string {
  const { formErrors, fieldErrors } = z.flattenError(error);
  return formErrors[0] ?? Object.values(fieldErrors).flat()[0] ?? porDefecto;
}

/** La persona con sesión, si puede hacer esa acción sobre esa cuenta. */
async function autorizar(
  objetivoId: string,
  accion: AccionSobreCuenta,
): Promise<{ quien: UsuarioActual } | { mensaje: string }> {
  const quien = await getUsuarioActual();
  if (!quien) return { mensaje: "Inicia sesión para administrar cuentas." };

  const permiso = puedeAdministrar({ quien, objetivoId, accion });
  if (!permiso.permitido) return { mensaje: permiso.mensaje };

  return { quien };
}

function esCorreoRepetido(error: { code?: string; status?: number } | null) {
  return error?.code === "email_exists" || error?.status === 422;
}

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------

export async function crearUsuario(
  _estadoPrevio: EstadoFormularioUsuario,
  formData: FormData,
): Promise<EstadoFormularioUsuario> {
  const escrito = leerFormularioUsuario(formData);
  const valores = soloEntrada(escrito);

  const quien = await getUsuarioActual();

  if (!quien) {
    return {
      ok: false,
      mensaje: "Inicia sesión para crear cuentas.",
      errores: {},
      valores,
    };
  }

  if (quien.rol !== "admin") {
    return {
      ok: false,
      mensaje: "Las cuentas las crea administración.",
      errores: {},
      valores,
    };
  }

  const validacion = nuevoUsuarioSchema.safeParse(escrito);

  if (!validacion.success) {
    return {
      ok: false,
      mensaje: "Revisa los campos marcados en rojo.",
      errores: z.flattenError(validacion.error).fieldErrors,
      valores,
    };
  }

  const nuevo = validacion.data;
  const admin = createAdminClient();

  const { data: cuenta, error: errorCuenta } =
    await admin.auth.admin.createUser({
      email: nuevo.email,
      password: nuevo.password,
      email_confirm: true,
      user_metadata: { nombre: nuevo.nombre },
    });

  if (errorCuenta || !cuenta.user) {
    if (esCorreoRepetido(errorCuenta)) {
      return {
        ok: false,
        mensaje: "",
        errores: { email: ["Ya hay una cuenta con ese correo"] },
        valores,
      };
    }

    console.error("[HU-24] No se pudo crear la cuenta", errorCuenta);
    return {
      ok: false,
      mensaje: "No se pudo crear la cuenta. Vuelve a intentarlo.",
      errores: {},
      valores,
    };
  }

  const supabase = await createClient();

  const { error: errorPerfil } = await supabase.from("usuario").insert({
    id: cuenta.user.id,
    nombre: nuevo.nombre,
    email: nuevo.email,
    rol: nuevo.rol,
  });

  if (errorPerfil) {
    // Sin perfil la cuenta no sirve y nadie la vería: se deshace el paso 1.
    const { error: errorBorrado } = await admin.auth.admin.deleteUser(
      cuenta.user.id,
    );
    if (errorBorrado) {
      console.error(
        "[HU-24] Quedó una cuenta sin perfil que no se pudo borrar",
        cuenta.user.id,
        errorBorrado,
      );
    }

    if (errorPerfil.code === DUPLICADO) {
      return {
        ok: false,
        mensaje: "",
        errores: { email: ["Ya hay una persona con ese correo"] },
        valores,
      };
    }

    console.error("[HU-24] No se pudo guardar el perfil", errorPerfil);
    return {
      ok: false,
      mensaje: "No se pudo guardar la persona. Vuelve a intentarlo.",
      errores: {},
      valores,
    };
  }

  revalidatePath("/usuarios");

  return {
    ok: true,
    mensaje: `Cuenta creada para ${nuevo.nombre} (${ETIQUETAS_ROL[nuevo.rol]}).`,
    errores: {},
    valores: ENTRADA_VACIA,
  };
}

// ---------------------------------------------------------------------------
// Editar nombre, correo y rol
// ---------------------------------------------------------------------------

export async function editarUsuario(
  _estadoPrevio: ResultadoCuenta,
  formData: FormData,
): Promise<ResultadoCuenta> {
  const validacion = editarUsuarioSchema.safeParse({
    id: formData.get("id"),
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    rol: formData.get("rol"),
  });

  if (!validacion.success) {
    return fallo(
      "Revisa los campos marcados en rojo.",
      z.flattenError(validacion.error).fieldErrors,
    );
  }

  const edicion = validacion.data;
  const actual = await obtenerUsuario(edicion.id);
  if (!actual) return fallo("No encontramos esa persona.");

  const cambiaRol = actual.rol !== edicion.rol;
  const auth = await autorizar(
    edicion.id,
    cambiaRol ? "cambiar_rol" : "editar",
  );
  if ("mensaje" in auth) return fallo(auth.mensaje);

  const supabase = await createClient();

  const { error: errorPerfil } = await supabase
    .from("usuario")
    .update({ nombre: edicion.nombre, email: edicion.email, rol: edicion.rol })
    .eq("id", edicion.id);

  if (errorPerfil) {
    if (errorPerfil.code === DUPLICADO) {
      return fallo("", { email: ["Ya hay una persona con ese correo"] });
    }
    if (errorPerfil.code === RLS_RECHAZO) {
      return fallo("Las cuentas las administra administración.");
    }
    console.error("[HU-24] No se pudo editar el perfil", errorPerfil);
    return fallo("No se pudo guardar. Vuelve a intentarlo.");
  }

  if (actual.email !== edicion.email) {
    const admin = createAdminClient();
    const { error: errorAuth } = await admin.auth.admin.updateUserById(
      edicion.id,
      { email: edicion.email, email_confirm: true },
    );

    if (errorAuth) {
      // Auth no aceptó el correo: el perfil vuelve a como estaba.
      await supabase
        .from("usuario")
        .update({ nombre: actual.nombre, email: actual.email, rol: actual.rol })
        .eq("id", edicion.id);

      if (esCorreoRepetido(errorAuth)) {
        return fallo("", { email: ["Ya hay una cuenta con ese correo"] });
      }
      console.error("[HU-24] No se pudo cambiar el correo en Auth", errorAuth);
      return fallo("No se pudo cambiar el correo. Vuelve a intentarlo.");
    }
  }

  revalidatePath("/usuarios");
  return { ok: true, mensaje: "Datos guardados.", errores: {} };
}

// ---------------------------------------------------------------------------
// Cambiar contraseña
// ---------------------------------------------------------------------------

export async function cambiarContrasena(
  _estadoPrevio: ResultadoCuenta,
  formData: FormData,
): Promise<ResultadoCuenta> {
  const validacion = cambiarContrasenaSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
  });

  if (!validacion.success) {
    return fallo("", z.flattenError(validacion.error).fieldErrors);
  }

  const { id, password } = validacion.data;

  const auth = await autorizar(id, "cambiar_contrasena");
  if ("mensaje" in auth) return fallo(auth.mensaje);

  if (!(await obtenerUsuario(id))) return fallo("No encontramos esa persona.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });

  if (error) {
    console.error("[HU-24] No se pudo cambiar la contraseña", error);
    return fallo("No se pudo cambiar la contraseña. Vuelve a intentarlo.");
  }

  return {
    ok: true,
    mensaje: "Contraseña cambiada. Dísela a la persona.",
    errores: {},
  };
}

// ---------------------------------------------------------------------------
// Desactivar y reactivar
// ---------------------------------------------------------------------------

export async function cambiarEstadoUsuario(
  _estadoPrevio: ResultadoCuenta,
  formData: FormData,
): Promise<ResultadoCuenta> {
  const validacion = idUsuarioSchema.safeParse({ id: formData.get("id") });
  if (!validacion.success) {
    return fallo(
      primerError(validacion.error, "No se pudo cambiar el estado."),
    );
  }

  const { id } = validacion.data;
  const actual = await obtenerUsuario(id);
  if (!actual) return fallo("No encontramos esa persona.");

  const activar = !actual.activo;

  // Reactivar es inocuo; desactivar es lo que no se puede hacer uno mismo.
  const auth = await autorizar(id, activar ? "editar" : "desactivar");
  if ("mensaje" in auth) return fallo(auth.mensaje);

  const supabase = await createClient();
  const { error: errorPerfil } = await supabase
    .from("usuario")
    .update({ activo: activar })
    .eq("id", id);

  if (errorPerfil) {
    if (errorPerfil.code === RLS_RECHAZO) {
      return fallo("Las cuentas las administra administración.");
    }
    console.error("[HU-24] No se pudo cambiar el estado", errorPerfil);
    return fallo("No se pudo cambiar el estado. Vuelve a intentarlo.");
  }

  // La base ya le cierra el acceso (rol_actual() es null si no está activa).
  // El bloqueo en Auth evita además que inicie sesión de nuevo.
  const admin = createAdminClient();
  const { error: errorAuth } = await admin.auth.admin.updateUserById(id, {
    ban_duration: activar ? "none" : BLOQUEO_INDEFINIDO,
  });

  if (errorAuth) {
    await supabase.from("usuario").update({ activo: !activar }).eq("id", id);
    console.error("[HU-24] No se pudo bloquear/desbloquear en Auth", errorAuth);
    return fallo("No se pudo cambiar el estado. Vuelve a intentarlo.");
  }

  revalidatePath("/usuarios");
  return {
    ok: true,
    mensaje: activar
      ? `${actual.nombre} vuelve a tener acceso.`
      : `${actual.nombre} ya no puede entrar. Su rastro en las órdenes se conserva.`,
    errores: {},
  };
}

// ---------------------------------------------------------------------------
// Borrar
// ---------------------------------------------------------------------------

export async function borrarUsuario(
  _estadoPrevio: ResultadoCuenta,
  formData: FormData,
): Promise<ResultadoCuenta> {
  const validacion = idUsuarioSchema.safeParse({ id: formData.get("id") });
  if (!validacion.success) {
    return fallo(primerError(validacion.error, "No se pudo borrar la cuenta."));
  }

  const { id } = validacion.data;

  const auth = await autorizar(id, "borrar");
  if ("mensaje" in auth) return fallo(auth.mensaje);

  const actual = await obtenerUsuario(id);
  if (!actual) return fallo("No encontramos esa persona.");

  // Primero el perfil: si la persona tiene rastro, la base lo frena aquí y no
  // se toca Auth. `usuario.id` referencia a `auth.users`, así que el orden
  // inverso tampoco sería posible.
  const supabase = await createClient();
  const { error: errorPerfil } = await supabase
    .from("usuario")
    .delete()
    .eq("id", id);

  if (errorPerfil) {
    if (errorPerfil.code === TIENE_RASTRO) {
      return fallo(
        `${actual.nombre} ya marcó o registró cosas en el sistema, y ese rastro no se borra. Desactiva la cuenta en vez de borrarla.`,
      );
    }
    if (errorPerfil.code === RLS_RECHAZO) {
      return fallo("Las cuentas las administra administración.");
    }
    console.error("[HU-24] No se pudo borrar el perfil", errorPerfil);
    return fallo("No se pudo borrar la cuenta. Vuelve a intentarlo.");
  }

  const admin = createAdminClient();
  const { error: errorAuth } = await admin.auth.admin.deleteUser(id);

  if (errorAuth) {
    // Sin perfil, la cuenta no ve nada (RLS exige perfil). Queda en el log
    // para borrarla a mano.
    console.error(
      "[HU-24] El perfil se borró pero la cuenta de Auth no",
      id,
      errorAuth,
    );
  }

  revalidatePath("/usuarios");
  return {
    ok: true,
    mensaje: `Cuenta de ${actual.nombre} borrada.`,
    errores: {},
  };
}
