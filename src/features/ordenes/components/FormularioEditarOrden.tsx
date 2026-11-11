"use client";

import { editarOrden } from "@/features/ordenes/actions";
import { FormularioOrden } from "@/features/ordenes/components/FormularioOrden";
import type { EntradaFormularioOrden } from "@/features/ordenes/formulario";

type Props = {
  ordenId: string;
  valores: EntradaFormularioOrden;
  /** Cuántas órdenes más tiene el cliente. */
  otrasOrdenesDelCliente: number;
};

/** Editar una orden que todavía no pasa a diseño (`docs/adr/0012`). */
export function FormularioEditarOrden({
  ordenId,
  valores,
  otrasOrdenesDelCliente,
}: Props) {
  const ayudaCliente =
    otrasOrdenesDelCliente > 0
      ? "Este cliente tiene otras órdenes: su razón social y su contacto no se cambian desde aquí. Si la orden es de otro cliente, escribe su NIT: si ya está registrado, se usan los datos que ya tiene."
      : "Si cambias el NIT por uno ya registrado, se usan los datos que ya tiene ese cliente.";

  return (
    <FormularioOrden
      accion={editarOrden}
      ordenId={ordenId}
      valoresIniciales={valores}
      textoGuardar="Guardar cambios"
      ayudaCliente={ayudaCliente}
    />
  );
}
