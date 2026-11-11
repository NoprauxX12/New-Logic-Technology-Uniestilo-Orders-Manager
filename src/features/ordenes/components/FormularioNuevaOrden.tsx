"use client";

import { registrarOrden } from "@/features/ordenes/actions";
import { FormularioOrden } from "@/features/ordenes/components/FormularioOrden";

/** HU-01 · Formulario de registro de una nueva orden. */
export function FormularioNuevaOrden() {
  return (
    <FormularioOrden
      accion={registrarOrden}
      textoGuardar="Guardar orden"
      textoTrasGuardar="Ya puedes registrar la siguiente."
      ayudaCliente="Si el NIT ya está registrado, se usa el cliente que ya existe."
    />
  );
}
