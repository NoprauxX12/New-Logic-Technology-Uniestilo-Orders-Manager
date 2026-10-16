"use client";

import { useActionState } from "react";

import { CampoTexto } from "@/components/ui/CampoTexto";
import {
  crearUsuario,
  type EstadoFormularioUsuario,
} from "@/features/usuarios/actions";
import { ENTRADA_VACIA } from "@/features/usuarios/formulario";
import { LARGO_MINIMO_CONTRASENA } from "@/features/usuarios/schemas";
import { ETIQUETAS_ROL, type Rol } from "@/features/workflow/checkpoints";

/**
 * HU-24 · Formulario con el que administración crea una cuenta.
 *
 * Cuatro campos y un botón (RNF-08). La contraseña inicial se escribe aquí y
 * administración se la dice a la persona; el campo se vacía siempre al
 * terminar, con error o sin él.
 */

const ESTADO_INICIAL: EstadoFormularioUsuario = {
  ok: false,
  mensaje: "",
  errores: {},
  valores: ENTRADA_VACIA,
};

const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

export function FormularioNuevoUsuario() {
  const [estado, enviar, enviando] = useActionState(
    crearUsuario,
    ESTADO_INICIAL,
  );

  const errorRol = estado.errores.rol?.[0];

  return (
    <form action={enviar} className="flex flex-col gap-6">
      {estado.ok && estado.mensaje ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
        >
          {estado.mensaje} Dile su contraseña a la persona.
        </p>
      ) : null}

      {!estado.ok && estado.mensaje ? (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
        >
          {estado.mensaje}
        </p>
      ) : null}

      <CampoTexto
        nombre="nombre"
        etiqueta="Nombre"
        marcador="Camila Ríos"
        autocompletar="off"
        errores={estado.errores.nombre}
        valorInicial={estado.valores.nombre}
      />

      <CampoTexto
        nombre="email"
        etiqueta="Correo"
        tipo="email"
        ayuda="Con este correo va a entrar al sistema"
        marcador="camila@uniestilo.com.co"
        autocompletar="off"
        errores={estado.errores.email}
        valorInicial={estado.valores.email}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="rol" className="text-base font-medium text-zinc-900">
          Rol
        </label>
        <p id="rol-ayuda" className="text-sm text-zinc-600">
          Define qué pantallas ve y qué puede marcar
        </p>
        <select
          id="rol"
          name="rol"
          defaultValue={estado.valores.rol}
          aria-invalid={Boolean(errorRol)}
          aria-describedby={errorRol ? "rol-ayuda rol-error" : "rol-ayuda"}
          className={[
            "min-h-12 rounded-lg border bg-white px-3 text-base text-zinc-900",
            "focus:ring-2 focus:ring-stone-500 focus:outline-none",
            errorRol ? "border-red-600" : "border-zinc-300",
          ].join(" ")}
        >
          <option value="">Escoge un rol</option>
          {ROLES.map((rol) => (
            <option key={rol} value={rol}>
              {ETIQUETAS_ROL[rol]}
            </option>
          ))}
        </select>
        {errorRol ? (
          <p
            id="rol-error"
            role="alert"
            className="text-sm font-medium text-red-700"
          >
            {errorRol}
          </p>
        ) : null}
      </div>

      <CampoTexto
        nombre="password"
        etiqueta="Contraseña inicial"
        tipo="password"
        ayuda={`Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres. La persona entra con ella`}
        autocompletar="new-password"
        errores={estado.errores.password}
      />

      <button
        type="submit"
        disabled={enviando}
        className="min-h-14 rounded-lg bg-stone-700 px-6 text-lg font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Creando…" : "Crear cuenta"}
      </button>
    </form>
  );
}
