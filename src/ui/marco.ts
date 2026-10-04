// Marco de la app (DR3, DR17): título de la pantalla con Ajustes arriba a la derecha, y cuatro pestañas,
// abajo en celular y en columna a la izquierda desde 1024 px. Landmarks: encabezado, navegación y contenido principal (DR18).
import "./marco.css";
import { t, type TextoId } from "../textos";
import { prepararTintas } from "./tintas";
import { subrayado } from "./trazos";

export const PESTANAS = ["mapa", "libro", "experimentos", "coach"] as const;
export type Pestana = (typeof PESTANAS)[number];

const TITULOS: Record<Pestana, TextoId> = { mapa: "mapa.titulo", libro: "nav.libro", experimentos: "nav.experimentos", coach: "nav.coach" };
// Íconos propios a dos tintas, sin caras: mapa plegado con su ruta, libro abierto, matraz con líquido y onda. Lo de clase "tinta2" va en la tinta de luz.
const ICONOS: Record<Pestana | "ajustes", string> = {
  mapa: '<path class="tinta2" d="M9 5.5 15 4v14.5L9 20Z"/><path d="M3 6.5 9 5.5 15 4l6 1.5V20l-6-1.5L9 20l-6-1.5ZM9 5.5V20M15 4v14.5"/><path d="M5 10.5c1.5 1 2 2.5 2 4M17.5 9l2 2M19.5 9l-2 2"/>',
  libro: '<path class="tinta2" d="M12 6.5c2-1.5 5-2 8.5-1.5v13c-3.5-.5-6.500 0-8.5 1.5Z"/><path d="M12 6.5C10 5 7 4.500 3.500 5v13c3.500-.5 6.500 0 8.500 1.500 2-1.5 5-2 8.500-1.500V5C17 4.500 14 5 12 6.500ZM12 6.500v13M6 9.500c1.500 0 2.800.2 3.800.7M6 12.500c1.500 0 2.800.2 3.800.7"/>',
  experimentos: '<path class="tinta2" d="M7.600 15h8.800l2.600 4.500a1.200 1.200 0 0 1-1 1.700H6a1.200 1.200 0 0 1-1-1.700Z"/><path d="M9.500 3.500h5M10.500 3.500v6L5 19a1.500 1.500 0 0 0 1.300 2.200h11.400A1.500 1.500 0 0 0 19 19l-5.500-9.500v-6M7.600 15h8.800"/><circle cx="11" cy="18" r=".6"/><circle cx="13.500" cy="17" r=".6"/>',
  coach: '<rect class="tinta2" x="3" y="5" width="18" height="14" rx="2"/><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M5.500 12h2l1.500-4 2.500 8 2-6 1.500 3.500 1-1.500h2.500"/>',
  ajustes: '<circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="12" r="6.5"/><path stroke-width="3" stroke-linecap="butt" d="M18.5 12.0L21.5 12.0M16.6 16.6L18.7 18.7M12.0 18.5L12.0 21.5M7.4 16.6L5.3 18.7M5.5 12.0L2.5 12.0M7.4 7.4L5.3 5.3M12.0 5.5L12.0 2.5M16.6 7.4L18.7 5.3"/>',
};
export const icono = (nombre: Pestana | "ajustes") => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="icono">${ICONOS[nombre]}</svg>`;

export interface Marco {
  raiz: HTMLElement;
  contenido: HTMLElement;
  // `conFoco`: lleva el foco al título, para cuando el cambio lo pidió la persona desde el contenido.
  activar(pestana: Pestana, conFoco?: boolean): void;
  // Una pantalla fuera de las pestañas (Ajustes): cambia el título y el contenido, y ninguna pestaña queda marcada.
  mostrar(titulo: string, ...nodos: Node[]): void;
  // Marca de sincronización (DR36): un texto corto a la izquierda de Ajustes, solo cuando algo no está confirmado por el servidor.
  marca(texto: string | null): void;
}

// `adornos`: una pegatina a la izquierda del título y una nota a mano a su derecha (DR13).
export function dibujarMarco(alCambiar: (pestana: Pestana, contenido: HTMLElement) => void, alAbrirAjustes: () => void, alTocarMarca: () => void = () => undefined, adornos: { izquierda?: HTMLElement; derecha?: HTMLElement } = {}): Marco {
  prepararTintas();
  const raiz = document.createElement("div");
  raiz.className = "marco";

  const encabezado = document.createElement("header");
  encabezado.className = "marco-encabezado";
  const titulo = document.createElement("h1");
  titulo.className = "nombre";
  titulo.tabIndex = -1;
  const ajustes = document.createElement("button");
  ajustes.type = "button";
  ajustes.className = "marco-ajustes";
  ajustes.setAttribute("aria-label", t("ajustes.titulo"));
  ajustes.innerHTML = icono("ajustes");
  ajustes.addEventListener("click", alAbrirAjustes);
  // La región viva anuncia la marca solo cuando cambia.
  const zonaMarca = document.createElement("div");
  zonaMarca.className = "marco-zona-marca";
  zonaMarca.setAttribute("aria-live", "polite");
  let textoMarca: string | null = null;
  function marca(texto: string | null) {
    if (texto === textoMarca) return;
    textoMarca = texto;
    zonaMarca.replaceChildren();
    if (!texto) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "marco-marca";
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" class="icono"><path d="M12 19V6M6.5 11.5 12 6l5.5 5.5M5 21h14"/></svg>';
    b.append(texto);
    b.addEventListener("click", alTocarMarca);
    zonaMarca.append(b);
  }
  for (const [lado, adorno] of Object.entries(adornos)) {
    adorno.classList.add("marco-adorno", lado);
    encabezado.append(adorno);
  }
  encabezado.append(titulo, zonaMarca, ajustes);

  const nav = document.createElement("nav");
  nav.className = "marco-pestanas";
  nav.setAttribute("aria-label", t("nav.nombre"));
  const botones = PESTANAS.map((pestana) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = icono(pestana);
    b.append(t(`nav.${pestana}`));
    b.addEventListener("click", () => activar(pestana, true));
    nav.append(b);
    return b;
  });

  const contenido = document.createElement("main");
  contenido.className = "marco-contenido lado-a-lado";
  raiz.append(encabezado, nav, contenido);

  // Al cambiar de pantalla el foco va al título, así el lector de pantalla anuncia dónde quedó.
  function pantalla(actual: Pestana | null, texto: string, conFoco: boolean) {
    botones.forEach((b, i) => (PESTANAS[i] === actual ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    // El subrayado del título es un trazo a mano, de ida y vuelta, en la segunda tinta.
    const palabra = Object.assign(document.createElement("span"), { textContent: texto });
    palabra.insertAdjacentHTML("beforeend", `<svg viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true" class="marco-subrayado"><path class="trazo" vector-effect="non-scaling-stroke" d="${subrayado({ x: 3, y: 4 }, 194, { grosor: 3, temblor: 0.8 }, 4)}"/></svg>`);
    titulo.replaceChildren(palabra);
    contenido.replaceChildren();
    if (conFoco) titulo.focus();
  }
  function activar(pestana: Pestana, conFoco = false) {
    pantalla(pestana, t(TITULOS[pestana]), conFoco);
    alCambiar(pestana, contenido);
  }
  function mostrar(texto: string, ...nodos: Node[]) {
    pantalla(null, texto, true);
    contenido.append(...nodos);
  }

  return { raiz, contenido, activar, mostrar, marca };
}
