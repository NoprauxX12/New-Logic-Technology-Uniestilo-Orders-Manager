import { BarraSuperior } from "@/components/layout/BarraSuperior";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

/**
 * Layout de las pantallas con sesión. El proxy ya exige sesión para llegar
 * aquí; esto carga a la persona para la barra de arriba. El acceso por rol a
 * cada pantalla lo decide cada página con `exigirAcceso` (HU-17), porque un
 * layout no sabe qué ruta se está pidiendo.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      {usuario ? <BarraSuperior usuario={usuario} /> : null}
      {children}
    </div>
  );
}
