"use client";

import { useActionState, useId, useState } from "react";

import { CampoTexto } from "@/components/ui/CampoTexto";
import {
  borrarUsuario,
  cambiarContrasena,
  cambiarEstadoUsuario,
  editarUsuario,
  type ResultadoCuenta,
} from "@/features/usuarios/actions";
import type { UsuarioListado } from "@/features/usuarios/queries";
import { puedeAdministrar } from "@/features/usuarios/reglas";
import { LARGO_MINIMO_CONTRASENA } from "@/features/usuarios/schemas";
import { ETIQUETAS_ROL, type Rol } from "@/features/workflow/checkpoints";

/**
 * HU-24 · Una persona con cuenta y lo que administración puede hacerle:
 * editar sus datos, cambiarle la contraseña, desactivarla o reactivarla, y
 * borrarla si no tiene rastro.
 *
 * Cerrada muestra solo quién es; "Editar" la abre. Cada cosa es su propio
 * formulario porque son actions distintas. Lo que no se puede hacer sobre la
 * propia cuenta no se ofrece, y se dice por qué.
 */

const ESTADO_INICIAL: ResultadoCuenta = { ok: false, mensaje: "", errores: {} };
const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

const BOTON_SECUNDARIO =
  "min-h-11 rounded-lg border border-zinc-400 px-4 text-base font-medium text-zinc-900 hover:bg-zinc-100 disabled:text-zinc-500";
const BOTON_PELIGRO =
  "min-h-11 rounded-lg border border-red-300 px-4 text-base font-medium text-red-700 hover:bg-red-50 disabled:text-zinc-500";

function Aviso({ estado }: { estado: ResultadoCuenta }) {
  if (!estado.mensaje) return null;
  return (
    <p
      role={estado.ok ? "status" : "alert"}
      className={
        estado.ok
          ? "rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
          : "rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-900"
      }
    >
      {estado.mensaje}
    </p>
  );
}

type Props = {
  usuario: UsuarioListado;
  /** El administrador que está mirando, para no ofrecerle lo que no puede hacerse a sí mismo. */
  quienId: string;
};

export function TarjetaUsuario({ usuario, quienId }: Props) {
  const [abierta, setAbierta] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const esMiCuenta = usuario.id === quienId;
  const yo = { id: quienId, rol: "admin" as const };
  const puedeCambiarRol = puedeAdministrar({
    quien: yo,
    objetivoId: usuario.id,
    accion: "cambiar_rol",
  });
  const puedeDesactivar = puedeAdministrar({
    quien: yo,
    objetivoId: usuario.id,
    accion: "desactivar",
  }).permitido;
  const puedeBorrar = puedeAdministrar({
    quien: yo,
    objetivoId: usuario.id,
    accion: "borrar",
  }).permitido;

  return (
    <li
      className={[
        "rounded-lg border bg-white px-4 py-3",
        usuario.activo ? "border-zinc-200" : "border-zinc-300 bg-zinc-50",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-medium text-zinc-900">
            {usuario.nombre}
            {esMiCuenta ? (
              <span className="ml-2 text-sm font-normal text-zinc-500">
                (tú)
              </span>
            ) : null}
          </p>
          <p className="text-sm text-zinc-600">{usuario.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!usuario.activo ? (
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700">
              Inactiva
            </span>
          ) : null}
          <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-800">
            {ETIQUETAS_ROL[usuario.rol]}
          </span>
          <button
            type="button"
            onClick={() => setAbierta((valor) => !valor)}
            aria-expanded={abierta}
            className={BOTON_SECUNDARIO}
          >
            {abierta ? "Cerrar" : "Editar"}
          </button>
        </div>
      </div>

      {abierta ? (
        <div className="mt-4 flex flex-col gap-6 border-t border-zinc-200 pt-4">
          {!puedeCambiarRol.permitido ? (
            <p className="text-sm text-zinc-600">{puedeCambiarRol.mensaje}</p>
          ) : null}

          <FormularioDatos
            usuario={usuario}
            puedeCambiarRol={puedeCambiarRol.permitido}
          />

          <FormularioContrasena usuarioId={usuario.id} />

          <div className="flex flex-wrap gap-3">
            {puedeDesactivar ? <BotonEstado usuario={usuario} /> : null}

            {puedeBorrar ? (
              confirmandoBorrado ? (
                <FormularioBorrar
                  usuario={usuario}
                  alCancelar={() => setConfirmandoBorrado(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoBorrado(true)}
                  className={BOTON_PELIGRO}
                >
                  Borrar cuenta
                </button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function FormularioDatos({
  usuario,
  puedeCambiarRol,
}: {
  usuario: UsuarioListado;
  puedeCambiarRol: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(
    editarUsuario,
    ESTADO_INICIAL,
  );
  const idBase = useId();
  const errorRol = estado.errores.rol?.[0];

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={usuario.id} />
      <Aviso estado={estado} />

      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          nombre="nombre"
          identificador={`${idBase}-nombre`}
          etiqueta="Nombre"
          valorInicial={usuario.nombre}
          errores={estado.errores.nombre}
        />
        <CampoTexto
          nombre="email"
          identificador={`${idBase}-email`}
          etiqueta="Correo"
          tipo="email"
          valorInicial={usuario.email}
          errores={estado.errores.email}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor={`${idBase}-rol`}
          className="text-base font-medium text-zinc-900"
        >
          Rol
        </label>
        <select
          id={`${idBase}-rol`}
          name="rol"
          defaultValue={usuario.rol}
          disabled={!puedeCambiarRol}
          aria-invalid={Boolean(errorRol)}
          aria-describedby={errorRol ? `${idBase}-rol-error` : undefined}
          className={[
            "min-h-12 rounded-lg border bg-white px-3 text-base text-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-500",
            "focus:ring-2 focus:ring-stone-500 focus:outline-none",
            errorRol ? "border-red-600" : "border-zinc-300",
          ].join(" ")}
        >
          {ROLES.map((rol) => (
            <option key={rol} value={rol}>
              {ETIQUETAS_ROL[rol]}
            </option>
          ))}
        </select>
        {/* Un select deshabilitado no viaja en el FormData: se manda el actual. */}
        {!puedeCambiarRol ? (
          <input type="hidden" name="rol" value={usuario.rol} />
        ) : null}
        {errorRol ? (
          <p
            id={`${idBase}-rol-error`}
            role="alert"
            className="text-sm font-medium text-red-700"
          >
            {errorRol}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="min-h-12 self-start rounded-lg bg-stone-700 px-5 text-base font-semibold text-white hover:bg-stone-800 disabled:bg-zinc-400"
      >
        {enviando ? "Guardando…" : "Guardar datos"}
      </button>
    </form>
  );
}

function FormularioContrasena({ usuarioId }: { usuarioId: string }) {
  const [estado, enviar, enviando] = useActionState(
    cambiarContrasena,
    ESTADO_INICIAL,
  );
  const idBase = useId();

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={usuarioId} />
      <Aviso estado={estado} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <CampoTexto
            nombre="password"
            identificador={`${idBase}-password`}
            etiqueta="Nueva contraseña"
            tipo="password"
            ayuda={`Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres`}
            autocompletar="new-password"
            errores={estado.errores.password}
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          className={`${BOTON_SECUNDARIO} min-h-12`}
        >
          {enviando ? "Cambiando…" : "Cambiar contraseña"}
        </button>
      </div>
    </form>
  );
}

function BotonEstado({ usuario }: { usuario: UsuarioListado }) {
  const [estado, enviar, enviando] = useActionState(
    cambiarEstadoUsuario,
    ESTADO_INICIAL,
  );

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={usuario.id} />
      <button type="submit" disabled={enviando} className={BOTON_SECUNDARIO}>
        {enviando ? "Guardando…" : usuario.activo ? "Desactivar" : "Reactivar"}
      </button>
      <Aviso estado={estado} />
    </form>
  );
}

function FormularioBorrar({
  usuario,
  alCancelar,
}: {
  usuario: UsuarioListado;
  alCancelar: () => void;
}) {
  const [estado, enviar, enviando] = useActionState(
    borrarUsuario,
    ESTADO_INICIAL,
  );

  return (
    <form
      action={enviar}
      className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3"
    >
      <input type="hidden" name="id" value={usuario.id} />
      <p className="text-sm text-red-900">
        ¿Borrar la cuenta de {usuario.nombre}? Solo se puede si nunca marcó
        nada; si ya tiene rastro, mejor desactívala.
      </p>
      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className={BOTON_PELIGRO}>
          {enviando ? "Borrando…" : "Sí, borrar"}
        </button>
        <button type="button" onClick={alCancelar} className={BOTON_SECUNDARIO}>
          Cancelar
        </button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}
