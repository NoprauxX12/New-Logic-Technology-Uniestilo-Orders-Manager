import { describe, expect, it } from "vitest";

import {
  destinatarioDeAlertaTela,
  puedeAtenderAlerta,
  puedeAvisarFaltaDeTela,
  puedeMarcarLlegadaDeTela,
} from "@/features/alertas/reglas";
import {
  ETIQUETAS_ROL,
  type CheckpointId,
  type Rol,
} from "@/features/workflow/checkpoints";

/**
 * HU-06 · Las reglas del aviso de falta de tela. El riesgo está en avisar en
 * el momento equivocado (con la tela ya usada) o dos veces por la misma orden,
 * y en que lo haga alguien que no valida telas.
 */

const HASTA_TELA: CheckpointId[] = [
  "cotizacion_aprobada",
  "programada_diseno",
  "ficha_adjunta",
  "tela_programada",
];

const HASTA_CORTE: CheckpointId[] = [...HASTA_TELA, "corte_completado"];

const ROLES = Object.keys(ETIQUETAS_ROL) as Rol[];

function mensajeDe(resultado: ReturnType<typeof puedeAvisarFaltaDeTela>) {
  return resultado.permitido ? null : resultado.mensaje;
}

describe("puedeAvisarFaltaDeTela", () => {
  it("deja avisar a secretaría en una orden recién registrada", () => {
    expect(
      puedeAvisarFaltaDeTela({
        marcados: [],
        tieneAlertaAbierta: false,
        rol: "secretaria",
      }),
    ).toEqual({ permitido: true });
  });

  it("deja avisar cuando la orden espera el corte", () => {
    expect(
      puedeAvisarFaltaDeTela({
        marcados: HASTA_TELA,
        tieneAlertaAbierta: false,
        rol: "secretaria",
      }),
    ).toEqual({ permitido: true });
  });

  it("solo secretaría avisa, ni siquiera administración, y dice a quién le toca", () => {
    for (const rol of ROLES.filter((r) => r !== "secretaria")) {
      const resultado = puedeAvisarFaltaDeTela({
        marcados: [],
        tieneAlertaAbierta: false,
        rol,
      });

      expect(resultado.permitido).toBe(false);
      expect(mensajeDe(resultado)).toContain("Secretaría");
    }
  });

  it("no deja avisar cuando la orden ya pasó por corte", () => {
    const resultado = puedeAvisarFaltaDeTela({
      marcados: HASTA_CORTE,
      tieneAlertaAbierta: false,
      rol: "secretaria",
    });

    expect(resultado.permitido).toBe(false);
    expect(mensajeDe(resultado)).toMatch(/ya pasó por corte/);
  });

  it("no deja avisar en una orden completada", () => {
    const resultado = puedeAvisarFaltaDeTela({
      marcados: [...HASTA_CORTE, "cerrada"],
      tieneAlertaAbierta: false,
      rol: "secretaria",
    });

    expect(mensajeDe(resultado)).toBe("La orden ya está completada.");
  });

  it("no deja avisar dos veces mientras la primera siga pendiente", () => {
    const resultado = puedeAvisarFaltaDeTela({
      marcados: HASTA_TELA,
      tieneAlertaAbierta: true,
      rol: "secretaria",
    });

    expect(resultado.permitido).toBe(false);
    expect(mensajeDe(resultado)).toMatch(/Ya se avisó/);
  });

  it("si el rol no corresponde, eso es lo que se dice, aunque ya haya alerta", () => {
    const resultado = puedeAvisarFaltaDeTela({
      marcados: HASTA_TELA,
      tieneAlertaAbierta: true,
      rol: "corte",
    });

    expect(mensajeDe(resultado)).toContain("Secretaría");
  });
});

describe("destinatarioDeAlertaTela", () => {
  it("no hay a quién avisar si no hay nadie en administración", () => {
    expect(destinatarioDeAlertaTela([])).toBeNull();
  });

  it("le llega a la única persona de administración", () => {
    expect(
      destinatarioDeAlertaTela([
        { id: "admin-1", creadoEn: "2026-09-01T10:00:00Z" },
      ]),
    ).toBe("admin-1");
  });

  it("con varias, le llega a la cuenta más antigua, sin importar el orden en que lleguen", () => {
    const administradores = [
      { id: "nueva", creadoEn: "2026-10-01T10:00:00Z" },
      { id: "duena", creadoEn: "2026-08-15T10:00:00Z" },
      { id: "otra", creadoEn: "2026-09-20T10:00:00Z" },
    ];

    expect(destinatarioDeAlertaTela(administradores)).toBe("duena");
    expect(destinatarioDeAlertaTela([...administradores].reverse())).toBe(
      "duena",
    );
  });

  it("no reordena la lista que recibe", () => {
    const administradores = [
      { id: "b", creadoEn: "2026-10-01T10:00:00Z" },
      { id: "a", creadoEn: "2026-08-15T10:00:00Z" },
    ];

    destinatarioDeAlertaTela(administradores);

    expect(administradores.map((admin) => admin.id)).toEqual(["b", "a"]);
  });
});

describe("puedeAtenderAlerta (HU-07)", () => {
  it("deja que administración marque la alerta como resuelta", () => {
    expect(puedeAtenderAlerta({ rol: "admin" })).toEqual({ permitido: true });
  });

  it("nadie más la resuelve, ni siquiera quien avisó", () => {
    for (const rol of ROLES.filter((r) => r !== "admin")) {
      const resultado = puedeAtenderAlerta({ rol });

      expect(resultado.permitido).toBe(false);
      expect(resultado.permitido === false && resultado.mensaje).toContain(
        "Administración",
      );
    }
  });
});

describe("puedeMarcarLlegadaDeTela (HU-22)", () => {
  it("deja a secretaría marcar la llegada cuando la orden espera tela", () => {
    expect(
      puedeMarcarLlegadaDeTela({ esperandoTela: true, rol: "secretaria" }),
    ).toEqual({ permitido: true });
  });

  it("no hay llegada que marcar si la orden no espera tela", () => {
    const resultado = puedeMarcarLlegadaDeTela({
      esperandoTela: false,
      rol: "secretaria",
    });

    expect(resultado.permitido === false && resultado.mensaje).toBe(
      "Esta orden no está esperando tela.",
    );
  });

  it("solo secretaría la marca, ni siquiera administración ni corte", () => {
    for (const rol of ROLES.filter((r) => r !== "secretaria")) {
      const resultado = puedeMarcarLlegadaDeTela({ esperandoTela: true, rol });

      expect(resultado.permitido).toBe(false);
      expect(resultado.permitido === false && resultado.mensaje).toContain(
        "Secretaría",
      );
    }
  });
});
