import { admin } from "./admin";
import { cuenta } from "./cuenta";
import { documentos } from "./documentos";

interface Env {
  ASSETS: Fetcher;
  // La base se conecta cuando exista (T69); hasta entonces la capa de cuentas responde "no disponible".
  DB?: D1Database;
  ACCESS_EQUIPO?: string;
  ACCESS_AUD?: string;
  // Clave de Resend con permiso solo de envío (secreto del Worker).
  RESEND_API_KEY?: string;
  EMAIL_EN_CONSOLA?: string;
  REGISTRO?: string;
}

const REMITENTE = "acceso@dhlab.app";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/v1/estado") return Response.json({ ok: true });
    if (pathname.startsWith("/v1/cuenta")) {
      if (!env.DB) return Response.json({ error: "no_disponible" }, { status: 503 });
      return cuenta(request, {
        DB: env.DB,
        REGISTRO: env.REGISTRO,
        // Sin envío configurado, el pedido falla a la vista ("no pudimos mandarte el email") en vez de simular que salió.
        enviarEmail: async ({ para, asunto, texto, html }) => {
          // Solo para probar en local con `wrangler dev` (.dev.vars): el email sale por la consola en vez de enviarse.
          if (env.EMAIL_EN_CONSOLA === "1") return console.log(`[email a ${para}] ${texto}`);
          if (!env.RESEND_API_KEY) throw new Error("sin envío de email");
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: `DH Lab <${REMITENTE}>`, to: [para], subject: asunto, text: texto, html }),
          });
          if (!r.ok) throw new Error(`Resend respondió ${r.status}`);
        },
      });
    }
    if (pathname.startsWith("/v1/documentos") || pathname === "/v1/clave") {
      if (!env.DB) return Response.json({ error: "no_disponible" }, { status: 503 });
      return documentos(request, { DB: env.DB });
    }
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      if (!env.DB) return Response.json({ error: "no_disponible" }, { status: 503 });
      return admin(request, { ...env, DB: env.DB });
    }
    if (pathname.startsWith("/v1/")) return Response.json({ error: "no_encontrado" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
