import "./mapa.css";
import { definicion } from "../engine/definicion";
import { CANALES, CENTROS, type CentroId } from "../engine/system-data";
import { t } from "../textos";
import { FORMAS, PUNTO_DE_PUERTA, ROTULOS, VISTA, centro, haciaRotulo, salida, type Punto } from "./mapa-geometria";
import { REBOTE, anima } from "./movimiento";
import { prepararTintas } from "./tintas";
import { contorno, flecha } from "./trazos";

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
  // La señal es un tramo corto del mismo trazo, que el CSS hace viajar cuando el movimiento es completo (va última: se junta en su capa).
  return [el("path", { d }, "mapa-cable"), enchufe(a), enchufe(b), el("path", { d, pathLength: 1 }, "mapa-senal")];
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

  // Los contornos van juntos en su propia capa, encima de las piezas (mapa.css).
  const contornos = el("g", {}, "mapa-contornos");
  for (const id of ids) {
    const r = ROTULOS[id];
    const desde = haciaRotulo(id);
    const ancho = CENTROS[id].length * 9.6 + 6;
    svg.append(el("line", { x1: desde.x, y1: desde.y, x2: r.ancla === "end" ? r.x - ancho : r.x + ancho, y2: r.y - 4 }, "mapa-guia"));
    const definido = centros.has(id);
    // La pieza entera va en un grupo, para poder moverla de una vez.
    const pieza = el("g", { "data-centro": id, style: `--i:${ids.indexOf(id)}` }, "mapa-pieza");
    svg.append(pieza);
    pieza.append(
      el("polygon", { points: puntos(FORMAS[id]) }, "mapa-centro"),
      // La tinta de luz va apenas corrida respecto del contorno (fuera de registro), con sus motas y su trama de sombra.
      ...(definido ? [el("polygon", { points: puntos(FORMAS[id], 1.8) }, "mapa-tinta"), el("polygon", { points: puntos(FORMAS[id], 1.8) }, "mapa-trama")] : []),
    );
    // El contorno va a pulso en la geometría, en tres variantes: el CSS muestra una por vez cuando el movimiento es completo.
    const borde = el("g", { "data-centro": id }, "mapa-contorno");
    for (const variante of [0, 1, 2]) borde.append(el("path", { d: contorno(FORMAS[id], 1.2, (ids.indexOf(id) + 1) * 7 + variante * 13) }));
    contornos.append(borde);
    svg.append(el("text", { x: r.x, y: r.y, "text-anchor": r.ancla }, "mapa-rotulo", CENTROS[id]));
    // La luz: un punto encendido con su halo, solo en los Centros definidos.
    if (definido) {
      const l = centro(FORMAS[id]);
      pieza.append(el("circle", { cx: l.x, cy: l.y, r: 15 }, "mapa-halo"), el("circle", { cx: l.x, cy: l.y, r: 7 }, "mapa-luz"));
    }
  }

  svg.append(contornos);

  // Un cable por Canal definido, de borde a borde de sus dos piezas.
  for (const canal of canales) {
    const [a, b] = extremos(canal);
    svg.append(...cable(salida(FORMAS[canal.centros[0]], a, b), salida(FORMAS[canal.centros[1]], b, a)));
  }
  // Las señales van juntas en su propia capa (mapa.css): se repintan en cada cuadro y así no arrastran los filtros del resto del mapa.
  const senales = el("g", {}, "mapa-senales");
  senales.append(...Array.from(svg.querySelectorAll(".mapa-senal")));
  svg.append(senales);

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
    boton.addEventListener("click", () => {
      // Respuesta al toque: la pieza salta y, si está definida, su luz destella.
      for (const parte of Array.from(svg.querySelectorAll(`[data-centro="${id}"]`))) anima(parte, [{ transform: "scale(.9)" }, { transform: "scale(1.08)", offset: 0.5 }, { transform: "none" }], { duration: 320 });
      anima(svg.querySelector(`.mapa-pieza[data-centro="${id}"] .mapa-halo`), [{ transform: "scale(1)", opacity: 0.9 }, { transform: "scale(2.4)", opacity: 0 }], { duration: 480 });
      alTocarCentro?.(id);
    });
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

// El cable del coach (DR12): sube por el margen izquierdo, que está libre, entra al Centro por su costado y lo deja resaltado.
// En mínimo aparece ya tendido.
export function senalarCentro(svg: Element, id: CentroId): void {
  const medio = centro(FORMAS[id]);
  const desde = { x: 18, y: VISTA.alto - 4 };
  const codo = { x: 18, y: medio.y + 24 };
  const hasta = salida(FORMAS[id], medio, codo);
  const cable = el("path", { d: `M${desde.x},${desde.y} Q${codo.x},${codo.y} ${hasta.x},${hasta.y}`, pathLength: 1 }, "mapa-coach");
  const boton = svg.querySelector(`.mapa-boton[aria-label^="${CENTROS[id]},"]`);
  boton?.before(cable);
  boton?.classList.add("mapa-resaltado");
  anima(cable, [{ strokeDasharray: "1", strokeDashoffset: 1 }, { strokeDasharray: "1", strokeDashoffset: 0 }], { duration: 520, easing: "ease-in-out" });
  anima(boton, [{ strokeOpacity: 0 }, { strokeOpacity: 1 }], { duration: 200, delay: 520 });
  for (const parte of Array.from(svg.querySelectorAll(`[data-centro="${id}"]`))) anima(parte, [{ transform: "scale(1.12)" }, { transform: "none" }], { duration: 320, delay: 520, easing: REBOTE, fill: "none" });
}
