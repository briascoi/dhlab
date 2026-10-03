// Capa de cuentas (T63): invitación, código de acceso por email, sesión, salir y borrar cuenta.
// Contrato: E3-acceso y E3-sesion del plan.

export interface EnvCuenta {
  DB: D1Database;
  // Envío de email reemplazable: Cloudflare Email Service u otro proveedor detrás de la misma función.
  enviarEmail?: (mensaje: { para: string; asunto: string; texto: string; html: string }) => Promise<void>;
}

const MIN = 60_000;
export const LIMITES = {
  codigoVence: 10 * MIN,
  intentos: 5,
  sesion: 30 * 24 * 60 * MIN,
  // Topes de envío aprobados por Isma el 2026-10-03, a ajustar con uso real.
  esperaReenvio: MIN,
  ventana: 60 * MIN,
  porEmail: 5,
  porIp: 20,
};

const json = (cuerpo: unknown, status = 200, headers: HeadersInit = {}) => Response.json(cuerpo, { status, headers });
const fallo = (error: string, status: number, extra: object = {}) => json({ error, ...extra }, status);

async function hash(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const azar = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
const codigoNuevo = () => String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, "0");
const emailValido = (e: unknown): e is string => typeof e === "string" && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const cookie = (valor: string, segundos: number) => `sesion=${valor}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${segundos}`;

// El email con el estilo de la app (papel, tinta y panel con sombra de impresión). Mismo texto aprobado que la versión plana.
// Los clientes de correo no cargan las tipografías del sitio: se usan las del sistema.
export function emailHtml(codigo: string): string {
  const sans = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";
  return `<!doctype html>
<html lang="es"><head><meta charset="UTF-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:32px 16px;background:#f4ede0;color:#1e1b24;font-family:${sans};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fbf7ef;border:2px solid #1e1b24;border-radius:2px;box-shadow:3px 3px 0 #1e1b24;">
<tr><td style="padding:32px 28px;">
<p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#5c5866;">Laboratorio de Diseño Humano</p>
<p style="margin:6px 0 28px;font-size:30px;font-weight:800;line-height:1.05;"><span style="border-bottom:8px solid #ff3ea5;">DH Lab</span></p>
<p style="margin:0 0 12px;font-size:17px;">Tu código de acceso es</p>
<p style="margin:0 0 12px;padding:14px 12px;border:2px solid #2742c7;border-radius:4px;color:#2742c7;font-family:'Martian Mono','SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;letter-spacing:0.3em;text-align:center;">${codigo}</p>
<p style="margin:0;font-size:17px;color:#5c5866;">Vence en 10 minutos.</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

export async function sesionDe(request: Request, env: EnvCuenta, ahora: number) {
  const id = /(?:^|;\s*)sesion=([a-f0-9]{64})/.exec(request.headers.get("Cookie") ?? "")?.[1];
  if (!id) return null;
  const h = await hash(id);
  const fila = await env.DB.prepare(
    "SELECT c.id, c.email, c.modo FROM sesiones s JOIN cuentas c ON c.id = s.cuenta_id WHERE s.hash = ? AND s.vence > ?",
  ).bind(h, ahora).first<{ id: string; email: string; modo: string }>();
  if (!fila) return null;
  // La sesión se renueva con cada uso.
  await env.DB.prepare("UPDATE sesiones SET vence = ? WHERE hash = ?").bind(ahora + LIMITES.sesion, h).run();
  return { ...fila, id_sesion: id, hash: h };
}

async function pedirAcceso(request: Request, env: EnvCuenta, ahora: number): Promise<Response> {
  const cuerpo = (await request.json().catch(() => ({}))) as { email?: unknown; modo?: unknown; idPedido?: unknown };
  const email = typeof cuerpo.email === "string" ? cuerpo.email.trim().toLowerCase() : cuerpo.email;
  if (!emailValido(email)) return fallo("email_invalido", 400);
  const modo = cuerpo.modo === "local" ? "local" : "nube";
  const idPedido = typeof cuerpo.idPedido === "string" && cuerpo.idPedido.length <= 64 ? cuerpo.idPedido : azar(16);
  const listo = { ok: true, reenviarEn: LIMITES.esperaReenvio / 1000 };

  const invitado = await env.DB.prepare(
    "SELECT 1 FROM invitaciones WHERE email = ?1 UNION SELECT 1 FROM cuentas WHERE email = ?1",
  ).bind(email).first();
  if (!invitado) return fallo("no_invitado", 403);

  // El mismo pedido repetido (recarga con el pedido en vuelo) no manda otro email ni gasta topes.
  const previo = await env.DB.prepare("SELECT id_pedido, creado FROM codigos WHERE email = ?").bind(email).first<{ id_pedido: string; creado: number }>();
  if (previo?.id_pedido === idPedido) return json(listo);
  if (previo && ahora - previo.creado < LIMITES.esperaReenvio) {
    return fallo("demasiados_pedidos", 429, { espera: Math.ceil((previo.creado + LIMITES.esperaReenvio - ahora) / 1000) });
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  const desde = ahora - LIMITES.ventana;
  const cuenta = (clave: string) => env.DB.prepare("SELECT COUNT(*) AS n FROM envios WHERE clave = ? AND momento > ?").bind(clave, desde).first<{ n: number }>();
  const [porEmail, porIp] = await Promise.all([cuenta(`e:${email}`), cuenta(`i:${ip}`)]);
  if (porEmail!.n >= LIMITES.porEmail || porIp!.n >= LIMITES.porIp) return fallo("demasiados_pedidos", 429, { espera: LIMITES.ventana / 1000 });

  const codigo = codigoNuevo();
  try {
    await env.enviarEmail?.({ para: email, asunto: "Tu código de acceso a DH Lab", texto: `Tu código de acceso es ${codigo}. Vence en 10 minutos.`, html: emailHtml(codigo) });
  } catch (causa) {
    // Sin el email ni el código: solo el motivo, para verlo con `wrangler tail`.
    console.error("envio_fallido", String(causa));
    return fallo("envio_fallido", 502);
  }
  await env.DB.batch([
    env.DB.prepare("INSERT OR REPLACE INTO codigos (email, hash, vence, intentos, id_pedido, modo, creado) VALUES (?, ?, ?, 0, ?, ?, ?)")
      .bind(email, await hash(`${email}:${codigo}`), ahora + LIMITES.codigoVence, idPedido, modo, ahora),
    env.DB.prepare("INSERT INTO envios (clave, momento) VALUES (?, ?), (?, ?)").bind(`e:${email}`, ahora, `i:${ip}`, ahora),
    env.DB.prepare("DELETE FROM envios WHERE momento <= ?").bind(desde),
  ]);
  return json(listo);
}

async function verificar(request: Request, env: EnvCuenta, ahora: number): Promise<Response> {
  const cuerpo = (await request.json().catch(() => ({}))) as { email?: unknown; codigo?: unknown };
  const email = typeof cuerpo.email === "string" ? cuerpo.email.trim().toLowerCase() : "";
  const codigo = typeof cuerpo.codigo === "string" ? cuerpo.codigo : "";
  const fila = await env.DB.prepare("SELECT hash, vence, intentos, modo FROM codigos WHERE email = ?").bind(email).first<{ hash: string; vence: number; intentos: number; modo: string }>();
  if (!fila || fila.vence <= ahora) return fallo("codigo_vencido", 410);
  if (fila.intentos >= LIMITES.intentos) return fallo("intentos_agotados", 429);
  if (fila.hash !== (await hash(`${email}:${codigo}`))) {
    await env.DB.prepare("UPDATE codigos SET intentos = intentos + 1 WHERE email = ?").bind(email).run();
    const quedan = LIMITES.intentos - fila.intentos - 1;
    return quedan > 0 ? fallo("codigo_incorrecto", 401, { quedan }) : fallo("intentos_agotados", 429);
  }

  const idSesion = azar(32);
  const idCuenta = azar(16);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM codigos WHERE email = ?").bind(email),
    // Si la cuenta ya existe, se conserva tal cual: el modo solo se elige al crearla.
    env.DB.prepare("INSERT OR IGNORE INTO cuentas (id, email, modo, creada) VALUES (?, ?, ?, ?)").bind(idCuenta, email, fila.modo, ahora),
    env.DB.prepare("INSERT INTO sesiones (hash, cuenta_id, vence) SELECT ?, id, ? FROM cuentas WHERE email = ?").bind(await hash(idSesion), ahora + LIMITES.sesion, email),
  ]);
  const cuenta = await env.DB.prepare("SELECT modo FROM cuentas WHERE email = ?").bind(email).first<{ modo: string }>();
  return json({ cuenta: { email, modo: cuenta!.modo } }, 200, { "Set-Cookie": cookie(idSesion, LIMITES.sesion / 1000) });
}

export async function cuenta(request: Request, env: EnvCuenta, ahora = Date.now()): Promise<Response> {
  const url = new URL(request.url);
  const ruta = `${request.method} ${url.pathname}`;
  // Todo pedido que cambia datos se rechaza si el Origin no es el del sitio.
  if (request.method !== "GET" && request.headers.get("Origin") !== url.origin) return fallo("origen_no_permitido", 403);

  if (ruta === "POST /v1/cuenta/acceso") return pedirAcceso(request, env, ahora);
  if (ruta === "POST /v1/cuenta/verificar") return verificar(request, env, ahora);

  const sesion = await sesionDe(request, env, ahora);
  if (!sesion) return fallo("sesion_vencida", 401);
  const renovada = { "Set-Cookie": cookie(sesion.id_sesion, LIMITES.sesion / 1000) };

  if (ruta === "GET /v1/cuenta") return json({ cuenta: { email: sesion.email, modo: sesion.modo } }, 200, renovada);
  if (ruta === "POST /v1/cuenta/salir") {
    await env.DB.prepare("DELETE FROM sesiones WHERE hash = ?").bind(sesion.hash).run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
  }
  if (ruta === "DELETE /v1/cuenta") {
    // Invariante 1: después de borrar la cuenta no queda ninguna fila suya.
    await env.DB.batch([
      env.DB.prepare("DELETE FROM cuentas WHERE id = ?").bind(sesion.id),
      env.DB.prepare("DELETE FROM invitaciones WHERE email = ?").bind(sesion.email),
      env.DB.prepare("DELETE FROM codigos WHERE email = ?").bind(sesion.email),
      env.DB.prepare("DELETE FROM envios WHERE clave = ?").bind(`e:${sesion.email}`),
    ]);
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", 0) });
  }
  return fallo("no_encontrado", 404);
}
