import "./mapa.css";
import { definicion } from "../engine/definicion";
import { CANALES, CENTROS, type CentroId } from "../engine/system-data";
import { t } from "../textos";
import { FORMAS, PUNTO_DE_PUERTA, ROTULOS, VISTA, centro, haciaRotulo, salida, type Punto } from "./mapa-geometria";
import { prepararTintas } from "./tintas";
import { flecha } from "./trazos";

const SVG = "http://www.w3.org/2000/svg";

function el(nombre: string, attrs: Record<string, string | number>, clase?: string, texto?: string): SVGElement {
  const e = document.createElementNS(SVG, nombre);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (clase) e.setAttribute("class", clase);
  if (texto) e.textContent = texto;
  return e;
}

const puntos = (forma: Punto[], dx = 0) => forma.map((p) => `${p.x + dx},${p.y + dx}`).join(" ");

// Un cable de parche: cuelga un poco entre sus dos conectores.
function control(a: Punto, b: Punto): Punto {
  const largo = Math.hypot(b.x - a.x, b.y - a.y);
  const caida = Math.min(14, largo * 0.18);
  return { x: (a.x + b.x) / 2 - ((b.y - a.y) / largo) * caida, y: (a.y + b.y) / 2 + Math.abs((b.x - a.x) / largo) * caida + caida * 0.3 };
}

function cable(a: Punto, b: Punto): SVGElement[] {
  const c = control(a, b);
  const d = `M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`;
  // El enchufe: un tramo corto y grueso que sale de la pieza en la dirección del cable.
  const enchufe = (o: Punto) => {
    const n = Math.hypot(c.x - o.x, c.y - o.y);
    return el("line", { x1: o.x, y1: o.y, x2: o.x + ((c.x - o.x) / n) * 10, y2: o.y + ((c.y - o.y) / n) * 10 }, "mapa-enchufe");
  };
  return [el("path", { d }, "mapa-cable"), enchufe(a), enchufe(b)];
}

// La etiqueta del panel del mapa.
export function rotuloMapa(): HTMLElement {
  const p = document.createElement("p");
  p.className = "rotulo etiqueta";
  p.textContent = t("mapa.rotulo");
  return p;
}

// Dibuja el mapa como en el mockup riso-consola: piezas chicas, Canales en líneas finas, solo lo definido con color y luz,
// y un cable de pieza a pieza por cada Canal definido. Las Puertas no se dibujan: quedan para el detalle de cada Centro
// y el modo técnico. Definido e indefinido se distinguen por relleno y luz frente a contorno, no solo por color.
// `anotacion`: una nota a mano que señala el mapa con una flecha curva (DR13).
export function dibujarMapa(puertasActivas: Iterable<number>, alTocarCentro?: (id: CentroId) => void, anotacion?: string): SVGElement {
  prepararTintas();
  const activas = new Set(puertasActivas);
  const { canales, centros } = definicion(activas);
  const svg = el("svg", { viewBox: `0 0 ${VISTA.ancho} ${VISTA.alto}`, role: "group", "aria-label": t("mapa.nombre") }, "mapa");
  const ids = Object.keys(FORMAS) as CentroId[];
  const extremos = (canal: (typeof CANALES)[number]) => canal.puertas.map((p) => PUNTO_DE_PUERTA[p]!) as [Punto, Punto];

  // Los 36 Canales, por debajo de las piezas.
  for (const canal of CANALES) {
    const [a, b] = extremos(canal);
    svg.append(el("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y }, "mapa-canal"));
  }

  for (const id of ids) {
    const r = ROTULOS[id];
    const desde = haciaRotulo(id);
    const ancho = CENTROS[id].length * 9.6 + 6;
    svg.append(el("line", { x1: desde.x, y1: desde.y, x2: r.ancla === "end" ? r.x - ancho : r.x + ancho, y2: r.y - 4 }, "mapa-guia"));
    const definido = centros.has(id);
    svg.append(
      el("polygon", { points: puntos(FORMAS[id]) }, "mapa-centro"),
      // La tinta de luz va apenas corrida respecto del contorno (fuera de registro), con sus motas y su trama de sombra.
      ...(definido ? [el("polygon", { points: puntos(FORMAS[id], 1.8) }, "mapa-tinta"), el("polygon", { points: puntos(FORMAS[id], 1.8) }, "mapa-trama")] : []),
      el("polygon", { points: puntos(FORMAS[id]) }, "mapa-contorno"),
      el("text", { x: r.x, y: r.y, "text-anchor": r.ancla }, "mapa-rotulo", CENTROS[id]),
    );
    // La luz: un punto encendido con su halo, solo en los Centros definidos.
    if (definido) {
      const l = centro(FORMAS[id]);
      svg.append(el("circle", { cx: l.x, cy: l.y, r: 15 }, "mapa-halo"), el("circle", { cx: l.x, cy: l.y, r: 7 }, "mapa-luz"));
    }
  }

  // Un cable por Canal definido, de borde a borde de sus dos piezas.
  for (const canal of canales) {
    const [a, b] = extremos(canal);
    svg.append(...cable(salida(FORMAS[canal.centros[0]], a, b), salida(FORMAS[canal.centros[1]], b, a)));
  }

  if (anotacion) {
    // A la izquierda del cuerpo, con la flecha en gancho hacia la Garganta.
    const destino = FORMAS.garganta[0]!;
    const f = flecha("gancho", { x: 96, y: 176 }, { x: destino.x - 6, y: destino.y + 30 }, { grosor: 2.5, temblor: 1.4 }, 11, -1);
    svg.append(el("text", { x: 8, y: 160 }, "anotacion mapa-anotacion", anotacion), el("path", { d: f.cuerpo }, "trazo"), el("path", { d: f.punta }, "trazo"));
  }

  // Los 9 Centros se tocan (DR4): un botón por Centro, encima de todo, con su estado en el nombre accesible.
  for (const id of ids) {
    const estado = t(centros.has(id) ? "mapa.centro.definido" : "mapa.centro.indefinido");
    const boton = el("polygon", { points: puntos(FORMAS[id]), role: "button", tabindex: 0, "aria-label": `${CENTROS[id]}, ${estado}` }, "mapa-boton");
    boton.addEventListener("click", () => alTocarCentro?.(id));
    boton.addEventListener("keydown", (e) => {
      const tecla = (e as KeyboardEvent).key;
      if (tecla === "Enter" || tecla === " ") {
        e.preventDefault();
        alTocarCentro?.(id);
      }
    });
    svg.append(boton);
  }
  return svg;
}
