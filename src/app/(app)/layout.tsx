export default function AppLayout({ children }: { children: React.ReactNode }) {
  // HU-16: la sesión ya es real. Cargar el usuario y su rol para el nav (o
  // para el guardia de rutas, si se decide hacerlo aquí) queda para cuando
  // haga falta algo más que las páginas que ya se resuelven cada una solas.
  return <div className="min-h-full bg-zinc-50">{children}</div>;
}
