import { ListaOrdenesMarcacion } from "@/features/workflow/components/ListaOrdenesMarcacion";
import { obtenerOrdenesParaMarcacion } from "@/features/workflow/consultasMarcacion";

export default async function OrdenesMarcacionPage() {
  const ordenes = await obtenerOrdenesParaMarcacion();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header>
        <p className="text-sm text-zinc-600">Uniestilo</p>

        <h1 className="text-3xl font-semibold text-zinc-900">
          Órdenes para marcación
        </h1>

        <p className="mt-2 text-zinc-600">
          Registra las órdenes recibidas por el área de marcación.
        </p>
      </header>

      <ListaOrdenesMarcacion ordenes={ordenes} />
    </main>
  );
}
