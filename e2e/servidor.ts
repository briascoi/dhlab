// Servidor simulado a nivel de red para los E2E: la app usa su cliente real (/v1/cuenta, /v1/documentos, /v1/clave).
// El código de acceso correcto es 123456.
import type { Page } from "@playwright/test";

export const CARTA = {
  esquema: 1,
  nacimiento: { fecha: "1990-05-15", hora: "14:30", confiabilidad: "exacta", margen: 15, pais: "AR", ciudad: ["Rosario", "Santa Fe", -32.95, -60.64, "America/Argentina/Cordoba"], residencia: "ES" },
  instante: "1990-05-15T17:30:00.000Z",
  inicio: "1990-05-15T17:25:00.000Z",
  fin: "1990-05-15T17:35:00.000Z",
  tzdb: "2026e",
};

export async function simularServidor(page: Page, { conSesion = false, carta = false } = {}) {
  const estado = {
    // Sin red: los pedidos de documentos no llegan.
    sinRed: false,
    // Cuántas veces falla el borrado de la cuenta antes de andar (BorradoServidorFallido).
    fallosAlBorrar: 0,
    // El cambio a solo local se hace, pero la respuesta no llega (corte de transporte).
    cortarCambio: false,
    // La IA incluida: apagada salvo que el test la prenda. `respuestas` es lo que contesta cada pedido, en orden.
    ia: { configurada: false, usado: 0, tope: 500_000, pausa: false, renovacion: "2026-11-01", reserva: { capitulo: 90_000, mensaje: 15_000 } },
    eventos: [] as string[],
    respuestasIA: [] as { status?: number; cuerpo: object }[],
    pedidosIA: [] as Record<string, unknown>[],
    // Cuántas veces falla el cambio a solo local antes de andar, sin haber cambiado nada.
    fallosAlCambiar: 0,
    // La clave del diario envuelta, como la guarda el servidor.
    clave: null as { idClave: string; envuelta: string; revision: number } | null,
    cuenta: conSesion ? { email: "prueba@ejemplo.com", modo: "nube" } : null,
    documentos: carta ? [{ tipo: "carta", id: "principal", contenido: JSON.stringify(CARTA), cifrado: false, version: 1 }] : ([] as { tipo: string; id: string; contenido: string; cifrado: boolean; version: number }[]),
  };
  await page.route("**/v1/**", async (ruta) => {
    const pedido = ruta.request();
    const camino = new URL(pedido.url()).pathname;
    const cuerpo = (pedido.postDataJSON() ?? {}) as Record<string, unknown>;
    const json = (body: unknown, status = 200) => ruta.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    // Los contadores de uso no piden sesión.
    if (camino === "/v1/evento") return estado.eventos.push(String(cuerpo.nombre)), json({ ok: true });
    if (camino === "/v1/cuenta/acceso") return json({ ok: true, reenviarEn: 15 });
    if (camino === "/v1/cuenta/verificar") {
      if (cuerpo.codigo !== "123456") return json({ error: "codigo_incorrecto", quedan: 4 }, 400);
      estado.cuenta = { email: String(cuerpo.email), modo: "nube" };
      return json({ cuenta: estado.cuenta });
    }
    if (!estado.cuenta) return json({ error: "sesion_vencida" }, 401);
    if (camino === "/v1/ia") {
      if (pedido.method() === "GET") return json(estado.ia);
      estado.pedidosIA.push(cuerpo);
      const r = estado.respuestasIA.shift() ?? { status: 502, cuerpo: { error: "salida_invalida" } };
      return json(r.cuerpo, r.status ?? 200);
    }
    if (camino === "/v1/cuenta/modo") {
      if (estado.fallosAlCambiar-- > 0) return json({ error: "no_disponible" }, 503);
      estado.cuenta = { ...estado.cuenta, modo: String(cuerpo.modo) };
      if (cuerpo.modo === "local") [estado.documentos, estado.clave] = [[], null];
      return estado.cortarCambio ? ruta.abort() : json({ cuenta: estado.cuenta });
    }
    if (camino === "/v1/cuenta/salir") return (estado.cuenta = null), json({ ok: true });
    if (camino === "/v1/cuenta" && pedido.method() === "DELETE") {
      if (estado.fallosAlBorrar-- > 0) return json({ error: "borrado_fallido" }, 500);
      estado.cuenta = null;
      estado.documentos = [];
      return json({ ok: true });
    }
    if (camino === "/v1/cuenta") return json({ cuenta: estado.cuenta });
    if (estado.sinRed && (camino.startsWith("/v1/documentos") || camino === "/v1/clave")) return ruta.abort();
    if (camino === "/v1/clave") {
      if (pedido.method() !== "PUT") return json({ clave: estado.clave });
      // "Empezar un diario nuevo": la clave vigente se cambia por otra y las entradas anteriores se borran.
      if (cuerpo.reemplaza !== undefined) {
        if (estado.clave?.idClave !== cuerpo.reemplaza) return json({ error: "conflicto", actual: estado.clave }, 409);
        estado.clave = { idClave: String(cuerpo.idClave), envuelta: String(cuerpo.envuelta), revision: estado.clave.revision + 1 };
        estado.documentos = estado.documentos.filter((d) => d.tipo !== "diario");
        return json({ clave: estado.clave });
      }
      if ((estado.clave?.revision ?? 0) !== cuerpo.revisionBase) return json({ error: "conflicto", actual: estado.clave }, 409);
      estado.clave = { idClave: String(cuerpo.idClave), envuelta: String(cuerpo.envuelta), revision: (estado.clave?.revision ?? 0) + 1 };
      return json({ clave: estado.clave });
    }
    if (camino === "/v1/documentos") return json({ documentos: estado.documentos });
    // Una cuenta solo local no tiene contenido en el servidor.
    if (estado.cuenta.modo === "local") return json({ error: "escritura_no_permitida" }, 403);
    const [, , , tipo, id] = camino.split("/");
    const previo = estado.documentos.find((d) => d.tipo === tipo && d.id === id);
    if ((previo?.version ?? 0) !== cuerpo.versionBase) return json({ error: "conflicto", actual: previo ?? null }, 409);
    if (pedido.method() === "DELETE") return (estado.documentos = estado.documentos.filter((d) => d !== previo)), json({ ok: true });
    const documento = { tipo: tipo!, id: id!, contenido: String(cuerpo.contenido), cifrado: cuerpo.cifrado === true, version: (previo?.version ?? 0) + 1 };
    estado.documentos = [...estado.documentos.filter((d) => d !== previo), documento];
    return json({ documento });
  });
  return estado;
}
