import "./cuenta.css";
import "./hora.css";
import type { Analisis } from "../engine/interval";
import { t, type TextoId } from "../textos";

// Pantallas de la hora: repetida o inexistente por el cambio de horario, y las posibilidades cuando la hora es incierta (DR6).

type Hijo = Node | string | false | null | undefined;
function h<K extends keyof HTMLElementTagNameMap>(etiqueta: K, attrs: Record<string, string> = {}, ...hijos: Hijo[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...hijos.filter((x): x is Node | string => Boolean(x)));
  return e;
}
const boton = (clase: string, texto: string, alTocar: () => void) => {
  const b = h("button", { type: "button", class: clase }, texto);
  b.addEventListener("click", alTocar);
  return b;
};
const pintar = (contenedor: HTMLElement, titulo: string, ...hijos: Hijo[]) => {
  const t1 = h("h2", { class: "hoja-titulo", tabindex: "-1" }, titulo);
  contenedor.replaceChildren(h("div", { class: "pantalla-hora" }, t1, ...hijos));
  t1.focus();
};

export const horaLocal = (instante: number, huso: string) => new Date(instante).toLocaleTimeString("es", { timeZone: huso, hour: "2-digit", minute: "2-digit" });

// La hora ocurrió dos veces: la persona elige cuál.
export function preguntarHoraRepetida(contenedor: HTMLElement, hora: string, opciones: Date[], alElegir: (instante: Date) => void): void {
  pintar(
    contenedor,
    t("hora.repetida.titulo"),
    h("p", {}, t("hora.repetida.explicacion", { hora })),
    boton("boton-secundario", t("hora.repetida.primera"), () => alElegir(opciones[0]!)),
    boton("boton-secundario", t("hora.repetida.segunda"), () => alElegir(opciones[1]!)),
  );
}

// La hora no existió: solo queda corregirla.
export function avisarHoraInexistente(contenedor: HTMLElement, hora: string, alCorregir: () => void): void {
  pintar(contenedor, t("hora.inexistente.titulo"), h("p", {}, t("hora.inexistente.explicacion", { hora })), boton("boton-principal", t("hora.corregir"), alCorregir));
}

// Una línea por cada combinación de Tipo, Autoridad y Perfil, con su hora de corte. Los tramos seguidos que solo difieren
// en piezas menores se unen, para no repetir la misma línea. La Autoridad se nombra solo cuando es ella la que cambia.
export function posibilidades(a: Analisis, huso: string): string[] {
  const grupos: { desde: number; hasta: number; tipo: string; autoridad: string; perfil: string }[] = [];
  for (const { desde, hasta, valor } of a.tramos) {
    const ultimo = grupos.at(-1);
    const perfil = valor.perfil.join("/");
    if (ultimo && ultimo.tipo === valor.tipo && ultimo.autoridad === valor.autoridad && ultimo.perfil === perfil) ultimo.hasta = hasta;
    else grupos.push({ desde, hasta, tipo: valor.tipo, autoridad: valor.autoridad, perfil });
  }
  const conAutoridad = a.autoridades.length > 1;
  return grupos.map((g) =>
    t(conAutoridad ? "hora.posibilidad_autoridad" : "hora.posibilidad", {
      desde: horaLocal(g.desde, huso),
      hasta: horaLocal(g.hasta, huso),
      tipo: t(`tipo.${g.tipo}` as TextoId),
      autoridad: t(`autoridad.${g.autoridad}` as TextoId),
      perfil: g.perfil,
    }),
  );
}

// Pendiente de hora (cambia el Tipo o la Autoridad): las posibilidades y "Corregir la hora". No se abren capítulos hasta confirmarla.
export function dibujarPendienteDeHora(contenedor: HTMLElement, a: Analisis, huso: string, alCorregir: () => void): void {
  pintar(
    contenedor,
    t("hora.pendiente.titulo"),
    h("p", {}, t(a.tipos.length > 1 ? "hora.pendiente.explicacion" : "hora.pendiente.explicacion_autoridad")),
    h("ul", { class: "posibilidades" }, ...posibilidades(a, huso).map((linea) => h("li", {}, linea))),
    h("p", { class: "espera" }, t("hora.pendiente.donde")),
    boton("boton-principal", t("hora.corregir"), alCorregir),
  );
}

// Hora incierta sin cambio de Tipo: banner en línea, la carta se usa igual.
export function bannerHoraIncierta(alCorregir: () => void): HTMLElement {
  return h("div", { class: "banner", role: "status" }, h("p", {}, h("strong", {}, t("hora.incierta.nota")), ". ", t("hora.incierta.explicacion")), boton("boton-link", t("hora.corregir"), alCorregir));
}
