"use client";

import { usePathname } from "next/navigation";

import { cambiarUsuarioActual } from "@/features/auth/actions";
import { ETIQUETAS_ROL } from "@/features/workflow/checkpoints";
import type { Database } from "@/types/database.types";

/**
 * Barra provisional para escoger con qué persona se está trabajando, mientras
 * no exista el login (HU-16). Se borra completa cuando llegue.
 *
 * Es de cliente solo para saber en qué ruta está: la acción necesita a dónde
 * devolver después de guardar la cookie, y eso no se sabe desde un layout.
 *
 * Es un formulario normal con su botón, no un desplegable que se envía solo al
 * cambiar: con teclado, moverse por las opciones con las flechas dispararía un
 * envío por cada opción que se pasa.
 */

type Persona = {
  id: string;
  nombre: string;
  rol: Database["public"]["Enums"]["rol"];
};

type Props = {
  personas: Persona[];
  /** Quién está escogido ahora, o `null` si nadie. */
  actualId: string | null;
};

export function SelectorDeUsuario({ personas, actualId }: Props) {
  const ruta = usePathname();

  return (
    <form
      action={cambiarUsuarioActual}
      className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2"
    >
      <input type="hidden" name="ruta" value={ruta} />

      <label htmlFor="usuarioId" className="text-sm font-medium text-amber-900">
        Estás actuando como
      </label>

      <select
        id="usuarioId"
        name="usuarioId"
        defaultValue={actualId ?? ""}
        className="min-h-9 rounded-lg border border-amber-400 bg-white px-2 text-sm text-zinc-900"
      >
        <option value="">Nadie</option>
        {personas.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.nombre} · {ETIQUETAS_ROL[persona.rol]}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="min-h-9 rounded-lg bg-amber-700 px-3 text-sm font-medium text-white hover:bg-amber-800"
      >
        Cambiar
      </button>

      <span className="text-xs text-amber-800">
        Provisional: reemplaza al login hasta HU-16.
      </span>
    </form>
  );
}
