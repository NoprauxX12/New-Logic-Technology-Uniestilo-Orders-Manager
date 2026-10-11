import { iniciarSesionRapido } from "@/features/auth/actions";
import { CUENTAS_DEMO } from "@/features/auth/cuentasDemo";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";

/**
 * Acceso rápido del login: un botón por cuenta del seed. Solo se muestra en
 * local (lo decide la página) y la action se niega en producción, así que
 * nunca es una puerta al sistema real.
 */
export function AccesoRapido() {
  return (
    <section
      aria-labelledby="acceso-rapido-titulo"
      className="flex flex-col gap-3"
    >
      <h2
        id="acceso-rapido-titulo"
        className="text-center text-sm font-medium text-zinc-500"
      >
        Acceso rápido · solo en local, con las cuentas del seed
      </h2>

      <ul className="grid grid-cols-2 gap-2">
        {CUENTAS_DEMO.map((cuenta) => (
          <li key={cuenta.email}>
            <form action={iniciarSesionRapido}>
              <input type="hidden" name="email" value={cuenta.email} />
              <button
                type="submit"
                className="hover:border-marca flex min-h-14 w-full flex-col items-start justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left hover:bg-white"
              >
                <span className="text-base font-semibold text-zinc-900">
                  {cuenta.nombre}
                </span>
                <span className="text-sm text-zinc-600">
                  {ETIQUETAS_ROL[cuenta.rol]}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
