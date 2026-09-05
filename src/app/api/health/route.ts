/** Health check para el monitoreo de disponibilidad (RNF-06). */
export function GET() {
  return Response.json({ status: "ok", timestamp: new Date().toISOString() });
}
