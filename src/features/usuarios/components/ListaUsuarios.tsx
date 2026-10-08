import type { UsuarioListado } from "@/features/usuarios/queries";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";

/** HU-24 · Quiénes ya tienen cuenta, con su rol. */
export function ListaUsuarios({ usuarios }: { usuarios: UsuarioListado[] }) {
  if (usuarios.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-300 bg-white px-4 py-6 text-base text-zinc-600">
        Todavía no hay personas con cuenta.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {usuarios.map((usuario) => (
        <li
          key={usuario.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3"
        >
          <div>
            <p className="text-base font-medium text-zinc-900">
              {usuario.nombre}
            </p>
            <p className="text-sm text-zinc-600">{usuario.email}</p>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-sm font-medium text-stone-800">
            {ETIQUETAS_ROL[usuario.rol]}
          </span>
        </li>
      ))}
    </ul>
  );
}
