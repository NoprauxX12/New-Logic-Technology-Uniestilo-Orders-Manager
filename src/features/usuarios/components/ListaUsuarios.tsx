import { TarjetaUsuario } from "@/features/usuarios/components/TarjetaUsuario";
import type { UsuarioListado } from "@/features/usuarios/queries";

/** HU-24 · Quiénes ya tienen cuenta, con lo que administración puede hacerles. */
export function ListaUsuarios({
  usuarios,
  quienId,
}: {
  usuarios: UsuarioListado[];
  quienId: string;
}) {
  if (usuarios.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-300 bg-white px-4 py-6 text-base text-zinc-600">
        Todavía no hay personas con cuenta.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {usuarios.map((usuario) => (
        <TarjetaUsuario key={usuario.id} usuario={usuario} quienId={quienId} />
      ))}
    </ul>
  );
}
