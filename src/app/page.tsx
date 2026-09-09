import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Uniestilo · Gestor de órdenes</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Sistema en construcción. Sprint 1: registro, corte, talleres, marcación,
        despacho y tablero.
      </p>
      <Link
        href="/tablero"
        className="inline-flex min-h-12 items-center rounded-lg bg-stone-700 px-6 text-base font-semibold text-white hover:bg-stone-800"
      >
        Ver el tablero de órdenes
      </Link>
    </main>
  );
}
