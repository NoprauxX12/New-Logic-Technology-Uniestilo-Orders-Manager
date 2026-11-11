import { BarraSuperior } from "@/components/layout/BarraSuperior";
import { AsistenteFlotante } from "@/features/asistente/components/AsistenteFlotante";
import { contarPorAtender } from "@/features/asistente/queries";
import { puedeUsarAsistente } from "@/features/asistente/reglas";
import { getUsuarioActual } from "@/lib/auth/usuarioActual";

/**
 * Layout de las pantallas con sesión. El proxy ya exige sesión para llegar
 * aquí; esto carga a la persona para la barra de arriba. El acceso por rol a
 * cada pantalla lo decide cada página con `exigirAcceso` (HU-17), porque un
 * layout no sabe qué ruta se está pidiendo.
 *
 * El asistente (HU-15) se monta aquí porque acompaña a administración en todas
 * sus pantallas; la action vuelve a comprobar el rol (regla 5). Su botón
 * muestra cuántas cosas hay por atender (HU-21).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();
  const conAsistente = usuario !== null && puedeUsarAsistente(usuario.rol);
  const porAtender = conAsistente ? await contarPorAtender() : 0;

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      {usuario ? <BarraSuperior usuario={usuario} /> : null}
      {children}
      {conAsistente ? <AsistenteFlotante porAtender={porAtender} /> : null}
    </div>
  );
}
