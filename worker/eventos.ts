// Contadores de uso (T67, primera parte): cuentan cuántas veces pasó algo por día. No guardan cuenta, identificador, IP ni texto,
// así que funcionan también antes del registro. El reenvío a PostHog con un id al azar por cuenta (E3-analytics) queda para cuando exista ese proyecto.
export const EVENTOS = ["carta_calculada", "cuenta_pedida", "capitulo_elegido", "entrada_escrita", "diario_cerrado", "capitulo_escrito", "capitulo_cortado", "coach_mensaje"];

export async function eventos(request: Request, env: { DB: D1Database }, ahora = Date.now()): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "POST" || request.headers.get("Origin") !== url.origin) return Response.json({ error: "no_encontrado" }, { status: 404 });
  const { nombre } = (await request.json().catch(() => ({}))) as { nombre?: unknown };
  // Solo los del catálogo: nada de texto libre.
  if (typeof nombre !== "string" || !EVENTOS.includes(nombre)) return Response.json({ error: "pedido_invalido" }, { status: 400 });
  await env.DB.prepare("INSERT INTO contadores (nombre, dia, n) VALUES (?, ?, 1) ON CONFLICT (nombre, dia) DO UPDATE SET n = n + 1").bind(nombre, new Date(ahora).toISOString().slice(0, 10)).run();
  return Response.json({ ok: true });
}
