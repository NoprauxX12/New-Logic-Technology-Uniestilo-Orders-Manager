export function EstadoVacioTablero() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center"
    >
      <p className="text-lg font-medium text-zinc-800">
        No hay órdenes registradas
      </p>
      <p className="max-w-sm text-sm text-zinc-600">
        Cuando se registre la primera orden de producción, aparecerá aquí el
        avance por etapa.
      </p>
    </div>
  );
}
