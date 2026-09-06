/**
 * Fuente única de la secuencia de etapas (CLAUDE.md regla 4).
 * UI del tablero, actions y (luego) RLS se derivan de aquí.
 * Cuando exista la BD, estos `id` deben coincidir con el enum/check de `avance_seccion.seccion`.
 */
export const CHECKPOINTS = [
  { id: "contacto", etiqueta: "Contacto", rolDueno: "secretaria" },
  { id: "recepcion", etiqueta: "Recepción", rolDueno: "secretaria" },
  { id: "validacion", etiqueta: "Validación", rolDueno: "secretaria" },
  { id: "ficha_tecnica", etiqueta: "Ficha técnica", rolDueno: "diseno" },
  { id: "programacion", etiqueta: "Programación", rolDueno: "secretaria" },
  { id: "trazo_corte", etiqueta: "Trazo y corte", rolDueno: "corte" },
  {
    id: "bordado_estampado",
    etiqueta: "Bordado / Estampado",
    rolDueno: "logistica",
  },
  {
    id: "despacho_satelites",
    etiqueta: "Despacho satélites",
    rolDueno: "logistica",
  },
  { id: "confeccion", etiqueta: "Confección", rolDueno: "logistica" },
  { id: "recoleccion", etiqueta: "Recolección", rolDueno: "logistica" },
  { id: "planchado", etiqueta: "Planchado", rolDueno: "marcacion" },
  { id: "empaque", etiqueta: "Empaque", rolDueno: "marcacion" },
  { id: "facturacion", etiqueta: "Facturación", rolDueno: "secretaria" },
] as const;

export type CheckpointId = (typeof CHECKPOINTS)[number]["id"];

export type RolDueno = (typeof CHECKPOINTS)[number]["rolDueno"];
