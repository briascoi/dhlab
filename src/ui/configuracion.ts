import "./configuracion.css";
import type { Analisis } from "../engine/interval";
import { DEL_TIPO } from "../engine/tipos";
import { t, type TextoId } from "../textos";
import { prepararTintas } from "./tintas";

// Panel "Tu configuración": los datos reales de la carta, una fila por dato, con perillas decorativas (sin escalas ni datos).
// Con la hora incierta, una fila muestra todos sus valores posibles.

const SVG = "http://www.w3.org/2000/svg";
function perilla(giro: number): SVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "perilla");
  svg.setAttribute("aria-hidden", "true");
  const circulo = (r: number, clase: string) => {
    const c = document.createElementNS(SVG, "circle");
    c.setAttribute("cx", "12");
    c.setAttribute("cy", "12");
    c.setAttribute("r", String(r));
    c.setAttribute("class", clase);
    return c;
  };
  const marca = document.createElementNS(SVG, "line");
  marca.setAttribute("x1", String(12 + 2.5 * Math.sin(giro)));
  marca.setAttribute("y1", String(12 - 2.5 * Math.cos(giro)));
  marca.setAttribute("x2", String(12 + 5.6 * Math.sin(giro)));
  marca.setAttribute("y2", String(12 - 5.6 * Math.cos(giro)));
  // Marcas alrededor, como en el mockup: son decorativas, sin números ni datos.
  const marcas = document.createElementNS(SVG, "path");
  marcas.setAttribute("class", "marcas");
  marcas.setAttribute("d", "M4.8 19.2L3.7 20.3M2.1 14.6L0.6 15.1M2.1 9.4L0.6 8.9M4.8 4.8L3.7 3.7M9.4 2.1L8.9 0.6M14.6 2.1L15.1 0.6M19.2 4.8L20.3 3.7M21.9 9.4L23.4 8.9M21.9 14.6L23.4 15.1M19.2 19.2L20.3 20.3");
  svg.append(marcas, circulo(8.6, "aro"), circulo(7, "cuerpo"), marca);
  return svg;
}

const unicos = <T>(xs: T[]) => [...new Set(xs)];

export function filasDeConfiguracion(a: Analisis): { rotulo: string; valores: string[] }[] {
  const cartas = a.tramos.map((x) => x.valor);
  const delTipo = (campo: "estrategia" | "firma" | "noYo", prefijo: string) => unicos(a.tipos.map((tipo) => t(`${prefijo}.${DEL_TIPO[tipo][campo]}` as TextoId)));
  const cuenta = (n: number, total: number) => t("configuracion.de", { n, total });
  return [
    { rotulo: t("configuracion.tipo"), valores: a.tipos.map((tipo) => t(`tipo.${tipo}`)) },
    { rotulo: t("configuracion.estrategia"), valores: delTipo("estrategia", "estrategia") },
    { rotulo: t("configuracion.autoridad"), valores: a.autoridades.map((autoridad) => t(`autoridad.${autoridad}`)) },
    { rotulo: t("configuracion.perfil"), valores: a.perfiles },
    { rotulo: t("configuracion.definicion"), valores: a.definiciones.map((d) => t(`definicion.${d}`)) },
    { rotulo: t("configuracion.centros"), valores: unicos(cartas.map((c) => cuenta(c.centros.length, 9))) },
    { rotulo: t("configuracion.canales"), valores: unicos(cartas.map((c) => cuenta(c.canales.length, 36))) },
    { rotulo: t("configuracion.firma"), valores: delTipo("firma", "firma") },
    { rotulo: t("configuracion.no_yo"), valores: delTipo("noYo", "no_yo") },
  ];
}

export function dibujarConfiguracion(a: Analisis): HTMLElement {
  prepararTintas();
  const panel = document.createElement("section");
  panel.className = "panel configuracion";
  const titulo = document.createElement("h2");
  titulo.className = "rotulo etiqueta";
  titulo.textContent = t("configuracion.titulo");
  const lista = document.createElement("dl");
  filasDeConfiguracion(a).forEach(({ rotulo, valores }, i) => {
    const fila = document.createElement("div");
    fila.className = valores.length > 1 ? "fila incierta" : "fila";
    const dt = document.createElement("dt");
    dt.append(perilla(-2.2 + (i * 1.7) % 4.4), rotulo);
    const dd = document.createElement("dd");
    dd.textContent = valores.join(t("configuracion.o"));
    fila.append(dt, dd);
    lista.append(fila);
  });
  panel.append(titulo, lista);
  return panel;
}
