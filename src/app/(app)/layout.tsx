export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Cuando exista auth (HU-16/17), aquí se carga sesión y rol.
  return <div className="min-h-full bg-zinc-50">{children}</div>;
}
