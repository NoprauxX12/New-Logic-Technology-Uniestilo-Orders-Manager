import { notFound } from "next/navigation";

import { exigirAcceso } from "@/features/auth/guardia";
import { FormularioDevolverOrden } from "@/features/correcciones/components/FormularioDevolverOrden";
import { FormularioOrdenCorreccion } from "@/features/correcciones/components/FormularioOrdenCorreccion";
import { obtenerOrdenParaCorreccion } from "@/features/correcciones/queries";
import {
  puedeCrearCorreccion,
  puedeDevolver,
} from "@/features/correcciones/reglas";
import { DetalleOrdenView } from "@/features/tablero/components/DetalleOrdenView";
import { TableroEnVivo } from "@/features/tablero/components/TableroEnVivo";
import { obtenerDetalleOrden } from "@/lib/ordenes/estadoOrden";
import { AccionMarcarAvance } from "@/features/workflow/components/AccionMarcarAvance";
import { puedeMarcar } from "@/features/workflow/transiciones";
import { hoyEnBogota } from "@/lib/utils/fechas";

type Props = {
  params: Promise<{ ordenId: string }>;
};

export default async function DetalleOrdenPage({ params }: Props) {
  const { ordenId } = await params;
  const usuario = await exigirAcceso(`/tablero/${ordenId}`);
  const orden = await obtenerDetalleOrden(ordenId);

  if (!orden) notFound();

  const marcados = orden.avances.map((avance) => avance.seccion);

  // Solo la salida a despacho (HU-19). La acción y el motor son genéricos, así
  // que las demás secciones se enchufan aquí pasando su propio checkpoint:
  // HU-12 `llegada_marcacion`, HU-13 `cerrada`.
  //
  // Se monta siempre, aunque el motor no deje marcar: es el componente el que
  // decide qué pintar. Si fuera esta página la que decidiera, al marcar con
  // éxito dejaría de renderizarlo, React lo desmontaría y se perdería la
  // confirmación justo en ese momento — y aquí llegan dos re-renders, el de
  // `revalidatePath` y el de Realtime.
  const accion = (
    <AccionMarcarAvance
      ordenId={orden.id}
      checkpoint="lista_despacho"
      veredicto={puedeMarcar({
        checkpoint: "lista_despacho",
        marcados,
        rol: usuario.rol,
        etapaInicial: orden.etapaInicial,
      })}
    />
  );

  // HU-18: ante un defecto, administración devuelve la orden a una etapa si va
  // en producción, o crea su orden de corrección si ya está cerrada. La página
  // es solo de administración (`exigirAcceso`); las reglas lo repiten.
  const sePuedeDevolver = puedeDevolver({ marcados, rol: usuario.rol });
  const sePuedeCorregir = puedeCrearCorreccion({ marcados, rol: usuario.rol });
  const paraCorregir = sePuedeCorregir.permitido
    ? await obtenerOrdenParaCorreccion(orden.id)
    : null;

  const correccion = (
    <>
      {sePuedeDevolver.permitido ? (
        <FormularioDevolverOrden
          ordenId={orden.id}
          marcados={marcados}
          etapaInicial={orden.etapaInicial}
        />
      ) : null}
      {paraCorregir ? (
        <FormularioOrdenCorreccion orden={paraCorregir} hoy={hoyEnBogota()} />
      ) : null}
    </>
  );

  return (
    <TableroEnVivo>
      <DetalleOrdenView orden={orden} accion={accion} correccion={correccion} />
    </TableroEnVivo>
  );
}
