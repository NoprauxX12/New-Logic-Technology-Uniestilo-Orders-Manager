import { describe, expect, it } from "vitest";

import { puedeUsarAsistente } from "@/features/asistente/reglas";
import { ETIQUETAS_ROL, type Rol } from "@/features/workflow/checkpoints";

describe("puedeUsarAsistente", () => {
  it("solo administración", () => {
    const roles = Object.keys(ETIQUETAS_ROL) as Rol[];
    const permitidos = roles.filter(puedeUsarAsistente);

    expect(permitidos).toEqual(["admin"]);
  });
});
