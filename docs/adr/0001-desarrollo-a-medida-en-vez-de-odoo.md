# 0001. Desarrollo a la medida en vez de Odoo

Fecha: 2026-08-05 · Estado: Aceptada

## Contexto

El Canvas del proyecto listaba dos caminos: configurar Odoo (módulo MRP) o construir una aplicación propia. El flujo de Uniestilo tiene particularidades: talleres satélite externos, checkpoints por sección con auditoría de quién y cuándo, órdenes de corrección por defectos y usuarios poco digitales que operan desde el celular.

## Decisión

Construir a la medida con Next.js + Supabase + Vercel. Odoo exigiría customización pesada de MRP para modelar los talleres satélite y los checkpoints, y el equipo no lo domina; el stack elegido sí. Lo único que se pierde de Odoo es la contabilidad, que no hace falta: Uniestilo ya tiene un servicio de facturación externo, así que el sistema solo registra el número de factura al cerrar la orden.

## Consecuencias

- El equipo controla el modelo de dominio y la UI (simplicidad por rol, español del taller).
- No hay facturación ni integración con la DIAN en el alcance.
- El esfuerzo va al dominio (motor de workflow, trazabilidad) y no a infraestructura, gracias a servicios gestionados.
