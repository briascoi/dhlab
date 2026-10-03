// Piezas compartidas por las pantallas completas (DR21): Ajustes y diario.
import { t, type TextoId } from "../textos";

export function el<K extends keyof HTMLElementTagNameMap>(nombre: K, clase = "", ...hijos: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(nombre);
  if (clase) e.className = clase;
  e.append(...hijos);
  return e;
}
export const boton = (clase: string, texto: string, alTocar: (b: HTMLButtonElement) => void) => {
  const b = el("button", clase, texto);
  b.type = "button";
  b.addEventListener("click", () => alTocar(b));
  return b;
};
// Un párrafo que el lector de pantalla anuncia: "alert" para errores, "status" para avances.
export const anuncio = (clase: string, rol: "alert" | "status") => {
  const p = el("p", clase);
  p.setAttribute("role", rol);
  return p;
};

// Pantalla completa: el foco va al título.
export function completa(titulo: TextoId, hijos: (cerrar: () => void) => Node[]): HTMLDialogElement {
  const hoja = el("dialog", "hoja completa");
  const encabezado = el("h2", "hoja-titulo", t(titulo));
  encabezado.tabIndex = -1;
  hoja.append(encabezado, ...hijos(() => hoja.close()));
  hoja.addEventListener("close", () => hoja.remove());
  document.body.append(hoja);
  hoja.showModal();
  encabezado.focus();
  return hoja;
}
