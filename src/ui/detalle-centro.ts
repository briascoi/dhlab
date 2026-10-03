import { definicion } from "../engine/definicion";
import { CANALES, CENTROS, type Canal, type CentroId } from "../engine/system-data";
import { t } from "../textos";

// Los Centros se abren con el Capítulo 4 (plan, "Mapa de capítulos").
export const CAPITULO_DE_CENTROS = 4;
export const CAPITULO_DE_CANALES = 5;

export interface Detalle {
  bloqueado: boolean;
  canales: { canal: Canal; estado: "definido" | "media" | "indefinido"; puerta?: number }[];
}

// Un Centro bloqueado no muestra contenido: solo el candado, su nombre y el capítulo que lo abre.
export function detalleCentro(id: CentroId, capitulosAbiertos: number, puertasActivas: Iterable<number>): Detalle {
  if (capitulosAbiertos < CAPITULO_DE_CENTROS) return { bloqueado: true, canales: [] };
  const activas = new Set(puertasActivas);
  const definidos = definicion(activas).canales;
  return {
    bloqueado: false,
    canales: CANALES.filter(({ centros }) => centros.includes(id)).map((canal) => {
      const puerta = canal.puertas.find((p) => activas.has(p));
      const estado = definidos.includes(canal) ? "definido" : puerta ? "media" : "indefinido";
      return estado === "media" ? { canal, estado, puerta } : { canal, estado };
    }),
  };
}

const CANDADO = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="candado"><rect x="5" y="10.5" width="14" height="10" rx="1"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none"/></svg>`;

// Cada Canal de la lista se toca (DR4): bloqueado muestra su candado; abierto, avisa a quien dibuja para que abra su sección.
export function dibujarDetalle(id: CentroId, capitulosAbiertos: number, puertasActivas: Iterable<number>, alTocarCanal?: (canal: Canal) => void): HTMLElement {
  const caja = document.createElement("section");
  caja.className = "detalle";
  caja.setAttribute("aria-live", "polite");
  const { bloqueado, canales } = detalleCentro(id, capitulosAbiertos, puertasActivas);
  const titulo = document.createElement("h2");
  titulo.className = "detalle-titulo";
  titulo.textContent = CENTROS[id];
  caja.append(titulo);
  const candado = (elemento: string, numero: number, titulo: string) => {
    const p = document.createElement("p");
    p.className = "detalle-candado";
    p.innerHTML = CANDADO;
    p.append(t("mapa.candado", { elemento, numero, titulo }));
    return p;
  };
  if (bloqueado) {
    caja.append(candado(CENTROS[id], CAPITULO_DE_CENTROS, t("capitulo.4.titulo")));
    return caja;
  }
  const rotulo = document.createElement("p");
  rotulo.className = "rotulo";
  rotulo.textContent = t("mapa.centro.canales");
  const lista = document.createElement("ul");
  lista.className = "detalle-canales";
  for (const { canal, estado, puerta } of canales) {
    const li = document.createElement("li");
    li.className = estado;
    const [a, b] = canal.puertas;
    const nota = estado === "definido" ? t("mapa.canal.definido") : estado === "media" ? t("mapa.canal.media", { puerta: puerta! }) : t("mapa.canal.indefinido");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = `${t("mapa.canal", { a, b })}: ${nota}`;
    boton.addEventListener("click", () => {
      if (capitulosAbiertos >= CAPITULO_DE_CANALES) return alTocarCanal?.(canal);
      caja.querySelector(".detalle-canales + .detalle-candado")?.remove();
      lista.after(candado(t("mapa.canal", { a, b }), CAPITULO_DE_CANALES, t("capitulo.5.titulo")));
    });
    li.append(boton);
    lista.append(li);
  }
  caja.append(rotulo, lista);
  return caja;
}
