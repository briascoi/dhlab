// Panel de Isma (/admin): detrás de Cloudflare Access. El Worker valida además el JWT de Access (defensa en profundidad).
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface EnvAdmin {
  DB: D1Database;
  ASSETS: Fetcher;
  // Dominio del equipo de Access (por ejemplo "equipo.cloudflareaccess.com") y etiqueta AUD de la aplicación.
  ACCESS_EQUIPO?: string;
  ACCESS_AUD?: string;
}

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });
const emailValido = (e: unknown): e is string => typeof e === "string" && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// Sin configuración de Access o sin un token válido, el panel no responde: falla cerrado.
async function autorizado(request: Request, env: EnvAdmin, claves?: JWTVerifyGetKey): Promise<boolean> {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_EQUIPO || !env.ACCESS_AUD) return false;
  const emisor = `https://${env.ACCESS_EQUIPO}`;
  try {
    await jwtVerify(token, claves ?? createRemoteJWKSet(new URL(`${emisor}/cdn-cgi/access/certs`)), { issuer: emisor, audience: env.ACCESS_AUD });
    return true;
  } catch {
    return false;
  }
}

export async function admin(request: Request, env: EnvAdmin, claves?: JWTVerifyGetKey, ahora = Date.now()): Promise<Response> {
  if (!(await autorizado(request, env, claves))) return json({ error: "no_autorizado" }, 403);
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/admin/api/")) return env.ASSETS.fetch(request);
  if (request.method !== "GET" && request.headers.get("Origin") !== url.origin) return json({ error: "origen_no_permitido" }, 403);
  if (url.pathname !== "/admin/api/invitaciones") return json({ error: "no_encontrado" }, 404);

  if (request.method === "GET") {
    const [invitaciones, cuentas] = await env.DB.batch([
      env.DB.prepare("SELECT email, creada FROM invitaciones ORDER BY creada DESC"),
      env.DB.prepare("SELECT email, modo, creada FROM cuentas ORDER BY creada DESC"),
    ]);
    return json({ invitaciones: invitaciones!.results, cuentas: cuentas!.results });
  }
  const cuerpo = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof cuerpo.email === "string" ? cuerpo.email.trim().toLowerCase() : cuerpo.email;
  if (!emailValido(email)) return json({ error: "email_invalido" }, 400);
  if (request.method === "POST") {
    await env.DB.prepare("INSERT OR IGNORE INTO invitaciones (email, creada) VALUES (?, ?)").bind(email, ahora).run();
    return json({ ok: true });
  }
  if (request.method === "DELETE") {
    // Quitar la invitación no borra una cuenta ya creada.
    await env.DB.prepare("DELETE FROM invitaciones WHERE email = ?").bind(email).run();
    return json({ ok: true });
  }
  return json({ error: "no_encontrado" }, 404);
}
