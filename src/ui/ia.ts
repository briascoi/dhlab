// Pantallas de la IA incluida: consentimiento antes del primer uso (R19, CEO2-S3d), la escritura de un capítulo con su espera (DR5, DR41),
// la sección escrita con su insignia y el coach (DR12, sin el osciloscopio todavía). Lo generado se muestra como texto plano, nunca como HTML.
import type { Fallo } from "../cuenta-api";
import type { EstadoIA, Respuesta, Seccion, Turno } from "../ia";
import { t, type TextoId } from "../textos";
import { anuncio, boton, completa, el } from "./pantalla";

const CONSENTIDA = "dhlab.ia_consentida";
// La aceptación es expresa y una sola vez por navegador; sin ella no sale ningún pedido.
export function conConsentimiento(seguir: () => void) {
  if (localStorage.getItem(CONSENTIDA)) return seguir();
  completa("ia.consentimiento.titulo", (cerrar) => [
    el("p", "", t("ia.consentimiento.que_recibe")),
    el("p", "", t("ia.consentimiento.incluida")),
    boton("boton-principal", t("ia.consentimiento.aceptar"), () => {
      localStorage.setItem(CONSENTIDA, new Date().toISOString());
      cerrar();
      seguir();
    }),
    boton("boton-link", t("comun.cancelar"), cerrar),
  ]);
}

// Usar la clave propia (DR40): qué implica, el campo ocultable y la prueba contra OpenRouter antes de guardarla.
// Conectarla cuenta como consentimiento: la pantalla dice qué recibe la IA y por dónde va.
export function abrirClave(conectar: (clave: string) => Promise<"conectada" | "invalida" | "sin_red">, alConectar: () => void) {
  const campo = el("input", "campo");
  Object.assign(campo, { id: "clave-openrouter", type: "password", autocomplete: "off", spellcheck: false });
  const rotulo = el("label", "rotulo-campo", t("ia.clave.rotulo"));
  rotulo.htmlFor = campo.id;
  const ver = boton("boton-link", t("ia.clave.mostrar"), (b) => {
    campo.type = campo.type === "password" ? "text" : "password";
    b.textContent = t(campo.type === "password" ? "ia.clave.mostrar" : "ia.clave.ocultar");
  });
  const estado = anuncio("estado", "status");
  const error = anuncio("error", "alert");
  completa("ia.clave.titulo", (cerrar) => [
    el("p", "", t("ia.consentimiento.que_recibe")),
    el("p", "", t("ia.clave.consentimiento")),
    el("p", "", t("ia.clave.guardado")),
    rotulo,
    campo,
    ver,
    estado,
    error,
    boton("boton-principal", t("ia.clave.pegar"), async (b) => {
      if (!campo.value.trim()) return campo.focus();
      b.disabled = true;
      error.textContent = "";
      estado.textContent = t("ia.clave.conectando");
      const r = await conectar(campo.value.trim());
      estado.textContent = "";
      b.disabled = false;
      if (r !== "conectada") return void (error.textContent = t(r === "invalida" ? "ia.clave.invalida" : "sync.sin_conexion"));
      localStorage.setItem(CONSENTIDA, new Date().toISOString());
      cerrar();
      alConectar();
    }),
    boton("boton-link", t("comun.cancelar"), cerrar),
  ]);
}

const fechaLarga = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es", { timeZone: "UTC", day: "numeric", month: "long" });
const errorDe = (r: Fallo & { renovacion?: string }): string =>
  r.error === "tope_global" ? `${t("ia.pausa")}.` : r.error === "tope_cuenta" ? `${t("ia.no_entra")} ${t("ia.renovacion", { fecha: fechaLarga(r.renovacion ?? "") })}` : r.error === "no_publicable" ? t("ia.capitulo.no_publicable") : r.error === "sin_red" ? t("ia.corte") : r.error === "corte_propia" ? t("ia.corte.propia") : r.error === "clave_invalida" ? t("ia.clave.invalida") : r.error === "sin_saldo" ? t("ia.clave.sin_saldo") : t("ia.error");

// Escribir un capítulo: un solo pedido que redacta y verifica. Mientras dura, la pantalla queda encendida y se puede cancelar;
// cancelado o cortado, el capítulo queda sin publicar (E3-largo).
export function abrirEscritura(estado: EstadoIA, escribir: (senal: AbortSignal) => Promise<object | Fallo>, alTerminar: (resultado: object) => void) {
  const etapas = el("ol", "etapas");
  const avance = el("div", "", etapas);
  avance.setAttribute("role", "status");
  const error = anuncio("error", "alert");
  let corte: AbortController | null = null;
  const empezar = boton("boton-principal", t("ia.capitulo.escribir"), async (b) => {
    // Si la reserva del capítulo no entra en lo que queda, se avisa antes de empezar (DR40).
    if (estado.pausa) return void (error.textContent = `${t("ia.pausa")}.`);
    if (estado.usado + estado.reserva.capitulo > estado.tope) return void (error.textContent = `${t("ia.no_entra")} ${t("ia.renovacion", { fecha: fechaLarga(estado.renovacion) })}`);
    b.disabled = true;
    error.textContent = "";
    etapas.replaceChildren(el("li", "", t("ia.capitulo.etapa")));
    corte = new AbortController();
    const bloqueo = await navigator.wakeLock?.request("screen").catch(() => null);
    const r = await escribir(corte.signal);
    void bloqueo?.release();
    corte = null;
    if (!("error" in r)) return hoja.close(), alTerminar(r);
    b.disabled = false;
    b.textContent = t("comun.reintentar");
    etapas.replaceChildren();
    if ((r as Fallo).error !== "cancelado") error.textContent = errorDe(r as Fallo);
  });
  const hoja = completa("ia.capitulo.escribir", (cerrar) => [el("p", "", t("ia.mantener_abierta")), avance, error, empezar, boton("boton-link", t("comun.cancelar"), () => (corte ? corte.abort() : cerrar()))]);
  hoja.addEventListener("cancel", (e) => corte && (e.preventDefault(), corte.abort()));
}

// La sección escrita: sus párrafos, de qué fichas sale cada afirmación y la insignia honesta. Con una ficha cambiada, se dice.
export function dibujarSeccion(seccion: Seccion, temaDe: (id: string) => string, desactualizada: boolean): HTMLElement {
  const caja = el("section", "seccion-ia");
  for (const p of seccion.parrafos) {
    caja.append(el("p", "", p.texto));
    if (p.tipo === "interpretativo") caja.append(el("p", "ficha-fuente", t("capitulo.fuente", { fuentes: (p.fuentes ?? []).map(temaDe).join("; ") })));
  }
  caja.append(el("p", "ficha-borrador", t(desactualizada ? "ia.desactualizado" : "ia.insignia")));
  return caja;
}

const FIJAS: Record<string, TextoId> = { sensible: "coach.sensible", ciencia: "coach.ciencia", sin_biblioteca: "coach.sin_biblioteca" };
// El coach: sin streaming, la respuesta aparece entera cuando pasó las guardas. Lo que se escribe no se guarda en ningún lado.
export function dibujarCoach(o: { preguntar: (texto: string, historial: Turno[]) => Promise<Respuesta | Fallo>; temaDe: (id: string) => string; anotar?: (texto: string) => Promise<void> }): HTMLElement {
  const panel = el("section", "panel capitulo coach");
  const charla = el("ol", "coach-charla");
  const estado = anuncio("estado", "status");
  const campo = el("textarea", "campo");
  campo.id = "coach-pregunta";
  campo.maxLength = 1000;
  const rotulo = el("label", "rotulo-campo", t("coach.rotulo"));
  rotulo.htmlFor = campo.id;
  const historial: Turno[] = [];
  const turno = (clase: string, quien: TextoId, ...hijos: (Node | string)[]) => charla.appendChild(el("li", clase, el("strong", "", t(quien)), ...hijos));
  const enviar = boton("boton-principal", t("coach.enviar"), async (b) => {
    const texto = campo.value.trim();
    if (!texto) return campo.focus();
    b.disabled = true;
    campo.value = "";
    turno("persona", "coach.tu", el("p", "", texto));
    estado.textContent = t("coach.pensando");
    const r = await o.preguntar(texto, historial);
    estado.textContent = "";
    b.disabled = false;
    if ("error" in r) return void turno("coach", "nav.coach", el("p", "error", errorDe(r)));
    if ("fija" in r) return void turno("coach", "nav.coach", el("p", "", t(FIJAS[r.fija]!)));
    const respuesta = r.parrafos.map((p) => p.texto).join("\n\n");
    historial.push({ rol: "persona", texto }, { rol: "coach", texto: respuesta });
    const item = turno("coach", "nav.coach");
    for (const p of r.parrafos) {
      item.append(el("p", "", p.texto));
      if (p.tipo === "interpretativo") item.append(el("p", "ficha-fuente", t("capitulo.fuente", { fuentes: (p.fuentes ?? []).map(o.temaDe).join("; ") })));
    }
    const anotar = o.anotar;
    if (anotar) item.append(boton("boton-link", t("coach.anotar"), async (a) => (await anotar(respuesta), a.replaceWith(el("p", "ficha-fuente", t("coach.anotado"))))));
  });
  panel.append(el("p", "ajustes-nota", t("coach.aclaracion")), charla, estado, rotulo, campo, enviar);
  return panel;
}
