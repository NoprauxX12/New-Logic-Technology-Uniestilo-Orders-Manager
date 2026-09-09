import { SelectorDeUsuario } from "@/features/auth/components/SelectorDeUsuario";
import { listarUsuarios } from "@/features/auth/queries";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Provisional hasta HU-16: la persona se escoge en un desplegable en vez de
  // entrar con usuario y contraseña. Cuando exista el login, se borra el
  // selector y `getUsuarioActual` pasa a leer la sesión.
  const [personas, actual] = await Promise.all([
    listarUsuarios(),
    getUsuarioActual(),
  ]);

  return (
    <div className="min-h-full bg-zinc-50">
      <SelectorDeUsuario personas={personas} actualId={actual?.id ?? null} />
      {children}
    </div>
  );
}
