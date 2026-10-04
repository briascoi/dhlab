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

// La pantallita del coach (DR12): un osciloscopio con rejilla de parlante, sin cara. La onda late al esperar, se acelera al pensar,
// se modula al responder y queda plana cuando no sabe. Es decorativa: el estado también va escrito. Con movimiento reducido, no se mueve.
const ONDA = "0,30.0 6,25.1 12,20.6 18,17.1 24,14.8 30,14.0 36,14.8 42,17.1 48,20.6 54,25.1 60,30.0 66,34.9 72,39.4 78,42.9 84,45.2 90,46.0 96,45.2 102,42.9 108,39.4 114,34.9 120,30.0 126,25.1 132,20.6 138,17.1 144,14.8 150,14.0 156,14.8 162,17.1 168,20.6 174,25.1 180,30.0 186,34.9 192,39.4 198,42.9 204,45.2 210,46.0 216,45.2 222,42.9 228,39.4 234,34.9 240,30.0 246,25.1 252,20.6 258,17.1 264,14.8 270,14.0 276,14.8 282,17.1 288,20.6 294,25.1 300,30.0 306,34.9 312,39.4 318,42.9 324,45.2 330,46.0 336,45.2 342,42.9 348,39.4 354,34.9 360,30.0 366,25.1 372,20.6 378,17.1 384,14.8 390,14.0 396,14.8 402,17.1 408,20.6 414,25.1 420,30.0 426,34.9 432,39.4 438,42.9 444,45.2 450,46.0 456,45.2 462,42.9 468,39.4 474,34.9 480,30.0";
function osciloscopio(): HTMLElement {
  const caja = el("div", "osciloscopio");
  caja.setAttribute("aria-hidden", "true");
  caja.dataset.estado = "esperando";
  const lineas = [15, 30, 45].map((y) => `<path class="rejilla" d="M0 ${y}H240"/>`).join("") + [60, 120, 180].map((x) => `<path class="rejilla" d="M${x} 0V60"/>`).join("");
  const parlante = [0, 1, 2, 3].flatMap((f) => [0, 1, 2].map((c) => `<circle class="parlante" cx="${256 + c * 10}" cy="${15 + f * 10}" r="2.2"/>`)).join("");
  caja.innerHTML = `<svg viewBox="0 0 290 60" preserveAspectRatio="none"><rect class="pantalla" x="1" y="1" width="238" height="58" rx="4"/>${lineas}<svg x="0" y="0" width="240" height="60" viewBox="0 0 240 60" overflow="hidden"><polyline class="onda" points="${ONDA}"/></svg>${parlante}</svg>`;
  return caja;
}

const FIJAS: Record<string, TextoId> = { sensible: "coach.sensible", ciencia: "coach.ciencia", sin_biblioteca: "coach.sin_biblioteca" };
// El coach: sin streaming, la respuesta aparece entera cuando pasó las guardas. Lo que se escribe no se guarda en ningún lado.
export function dibujarCoach(o: { alMapa?: (centro: string) => void; fichaDe: (id: string) => { tema: string; texto: string; fuente: string } | undefined; alCapitulo: () => void; preguntar: (texto: string, historial: Turno[]) => Promise<Respuesta | Fallo>; temaDe: (id: string) => string; anotar?: (texto: string) => Promise<void> }): HTMLElement {
  const panel = el("section", "panel capitulo coach");
  const pantalla = osciloscopio();
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
    pantalla.dataset.estado = "pensando";
    const r = await o.preguntar(texto, historial);
    estado.textContent = "";
    b.disabled = false;
    pantalla.dataset.estado = "parrafos" in r ? "responde" : "no_sabe";
    if ("error" in r) return void turno("coach", "nav.coach", el("p", "error", errorDe(r)));
    if ("fija" in r) return void turno("coach", "nav.coach", el("p", "", t(FIJAS[r.fija]!)));
    const respuesta = r.parrafos.map((p) => p.texto).join("\n\n");
    historial.push({ rol: "persona", texto }, { rol: "coach", texto: respuesta });
    const item = turno("coach", "nav.coach");
    for (const p of r.parrafos) {
      item.append(el("p", "", p.texto));
      if (p.tipo === "interpretativo") item.append(el("p", "ficha-fuente", t("capitulo.fuente", { fuentes: (p.fuentes ?? []).map(o.temaDe).join("; ") })));
    }
    // Acciones bajo la respuesta (DR12): ver las fichas que la respaldan y volver al capítulo.
    const citadas = [...new Set(r.parrafos.flatMap((p) => p.fuentes ?? []))].flatMap((id) => o.fichaDe(id) ?? []);
    if (citadas.length) item.append(el("details", "", el("summary", "boton-link", t("coach.ver_fuente")), ...citadas.flatMap((f) => [el("p", "", el("strong", "", `${f.tema}. `), f.texto), el("p", "ficha-fuente", f.fuente)])));
    // Si la respuesta habla de un Centro, se puede ir a verlo en el mapa, con ese Centro resaltado y su detalle abierto.
    const centro = r.parrafos.flatMap((p) => p.fuentes ?? []).map((id) => /^centro\.(\w+)\./.exec(id)?.[1]).find(Boolean);
    const alMapa = o.alMapa;
    if (centro && alMapa) item.append(boton("coach-accion", t("coach.en_mapa"), () => alMapa(centro)));
    item.append(boton("coach-accion", t("coach.al_capitulo"), o.alCapitulo));
    const anotar = o.anotar;
    if (anotar) item.append(boton("boton-link", t("coach.anotar"), async (a) => (await anotar(respuesta), a.replaceWith(el("p", "ficha-fuente", t("coach.anotado"))))));
  });
  panel.append(pantalla, el("p", "ajustes-nota", t("coach.aclaracion")), charla, estado, rotulo, campo, enviar);
  return panel;
}
