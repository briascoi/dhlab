import { CANALES, CENTRO_DE_PUERTA, type CentroId } from "../engine/system-data";

// Geometría propia del mapa: cada Centro es una pieza de la consola y cada Puerta, un conector dentro de su pieza.
export type Punto = { x: number; y: number };

// La vista deja lugar a la derecha para los rótulos y a la izquierda para el del Bazo, como en el mockup riso-consola.
export const VISTA = { ancho: 500, alto: 590 };
// Los conectores ya no se dibujan (los 64 quedan para el modo técnico): solo marcan de dónde sale cada Canal.
const SEPARACION = 6;
const MARGEN = 5; // distancia del conector al borde de su pieza
const DX = 48; // corrimiento del cuerpo hacia la derecha

const poli = (...xy: number[]): Punto[] => xy.flatMap((x, i) => (i % 2 ? [] : [{ x: x + DX, y: xy[i + 1]! }]));
const cuadrado = (x: number, y: number, h: number) => poli(x - h, y - h, x + h, y - h, x + h, y + h, x - h, y + h);

export const centro = (forma: Punto[]): Punto => ({
  x: forma.reduce((s, p) => s + p.x, 0) / forma.length,
  y: forma.reduce((s, p) => s + p.y, 0) / forma.length,
});
export const FORMAS: Record<CentroId, Punto[]> = {
  cabeza: poli(165, 14, 205, 78, 125, 78),
  ajna: poli(121, 96, 209, 96, 165, 166),
  garganta: cuadrado(165, 218, 36),
  g: poli(165, 274, 207, 316, 165, 358, 123, 316),
  corazon: poli(214, 380, 286, 380, 254, 318),
  sacral: cuadrado(165, 426, 36),
  bazo: poli(22, 386, 22, 474, 100, 430),
  plexo: poli(308, 386, 308, 474, 230, 430),
  raiz: cuadrado(165, 540, 36),
};

// Los rótulos van afuera de las piezas, en una columna a la derecha (el Bazo, a la izquierda), cada uno con su guía punteada.
export const ROTULOS: Record<CentroId, Punto & { ancla: "start" | "end"; desde?: Punto }> = {
  cabeza: { x: 496, y: 58, ancla: "end" },
  ajna: { x: 496, y: 124, ancla: "end" },
  garganta: { x: 496, y: 223, ancla: "end" },
  g: { x: 496, y: 300, ancla: "end" },
  corazon: { x: 496, y: 352, ancla: "end" },
  plexo: { x: 496, y: 414, ancla: "end" },
  // La guía del Sacral sale de su esquina inferior derecha, para pasar por debajo del Plexo Solar.
  sacral: { x: 496, y: 512, ancla: "end", desde: { x: 201 + DX, y: 462 } },
  bazo: { x: 2, y: 372, ancla: "start" },
  raiz: { x: 496, y: 545, ancla: "end" },
};

export function dentro(p: Punto, forma: Punto[]): boolean {
  let adentro = false;
  for (let i = 0, j = forma.length - 1; i < forma.length; j = i++) {
    const a = forma[i]!;
    const b = forma[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) adentro = !adentro;
  }
  return adentro;
}

// Dónde corta el borde de la forma el rayo que sale de `o` en la dirección `d`.
function rayo(forma: Punto[], o: Punto, d: Punto): { punto: Punto; lado: number; fraccion: number } {
  let t = Infinity;
  let lado = 0;
  let fraccion = 0;
  for (let i = 0; i < forma.length; i++) {
    const a = forma[i]!;
    const b = forma[(i + 1) % forma.length]!;
    const e = { x: b.x - a.x, y: b.y - a.y };
    const det = d.x * e.y - d.y * e.x;
    if (Math.abs(det) < 1e-9) continue;
    const s = ((a.x - o.x) * e.y - (a.y - o.y) * e.x) / det;
    const u = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / det;
    if (s > 0 && u >= 0 && u <= 1 && s < t) [t, lado, fraccion] = [s, i, u];
  }
  return { punto: { x: o.x + d.x * t, y: o.y + d.y * t }, lado, fraccion };
}
const borde = (forma: Punto[], angulo: number) => rayo(forma, centro(forma), { x: Math.cos(angulo), y: Math.sin(angulo) });

// Punto del borde por donde sale de su pieza el Canal que va del conector `a` hacia `b`.
export const salida = (forma: Punto[], a: Punto, b: Punto): Punto => rayo(forma, a, { x: b.x - a.x, y: b.y - a.y }).punto;

const largo = (a: Punto, b: Punto) => Math.hypot(b.x - a.x, b.y - a.y);

// El riel de los conectores: la pieza achicada hacia su centro hasta dejar MARGEN contra el lado más cercano.
function riel(forma: Punto[]): Punto[] {
  const o = centro(forma);
  const alLado = forma.map((a, i) => {
    const b = forma[(i + 1) % forma.length]!;
    return Math.abs((b.x - a.x) * (a.y - o.y) - (b.y - a.y) * (a.x - o.x)) / largo(a, b);
  });
  const k = 1 - MARGEN / Math.min(...alLado);
  return forma.map((p) => ({ x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k }));
}

// Punto del riel a una distancia `s` recorrida desde su primer vértice (da la vuelta las veces que haga falta).
function enRiel(r: Punto[], s: number): Punto {
  const total = r.reduce((suma, a, i) => suma + largo(a, r[(i + 1) % r.length]!), 0);
  let resto = ((s % total) + total) % total;
  for (let i = 0; ; i = (i + 1) % r.length) {
    const a = r[i]!;
    const b = r[(i + 1) % r.length]!;
    const l = largo(a, b);
    if (resto <= l) return { x: a.x + ((b.x - a.x) * resto) / l, y: a.y + ((b.y - a.y) * resto) / l };
    resto -= l;
  }
}

const companera = (puerta: number): number => {
  const [a, b] = CANALES.find(({ puertas }) => puertas.includes(puerta))!.puertas;
  return a === puerta ? b : a;
};

function calcular(): Record<number, Punto> {
  const ids = Object.keys(FORMAS) as CentroId[];
  const puntos: Record<number, Punto> = {};
  for (const id of ids) {
    const r = riel(FORMAS[id]);
    const o = centro(r);
    const total = r.reduce((suma, a, i) => suma + largo(a, r[(i + 1) % r.length]!), 0);
    const items = Object.keys(CENTRO_DE_PUERTA)
      .map(Number)
      .filter((p) => CENTRO_DE_PUERTA[p] === id)
      .map((p) => {
        const vecino = CENTRO_DE_PUERTA[companera(p)]!;
        const destino = centro(FORMAS[vecino]);
        // Los Canales de un mismo par de Centros salen en el mismo orden de los dos lados, para no cruzarse.
        const haz = CANALES.filter(({ centros }) => centros.includes(id) && centros.includes(vecino));
        const orden = haz.findIndex(({ puertas }) => puertas.includes(p)) - (haz.length - 1) / 2;
        const sentido = ids.indexOf(id) < ids.indexOf(vecino) ? 1 : -1;
        // Cada conector arranca donde su Canal sale de la pieza, medido como distancia recorrida sobre el riel.
        const { lado, fraccion } = borde(r, Math.atan2(destino.y - o.y, destino.x - o.x) + sentido * orden * 0.01);
        const hasta = r.slice(0, lado).reduce((suma, a, i) => suma + largo(a, r[i + 1]!), 0);
        return { p, s: hasta + fraccion * largo(r[lado]!, r[(lado + 1) % r.length]!) };
      })
      .sort((u, v) => u.s - v.s);
    // Los que quedarían encimados se reparten a lo largo del riel, sin cambiar su orden: en la punta de un triángulo,
    // donde llegan varios Canales, los conectores se abren hacia los dos lados en vez de amontonarse.
    for (let vuelta = 0; vuelta < 4000 && items.length > 1; vuelta++) {
      let movio = false;
      for (let i = 0; i < items.length; i++) {
        const u = items[i]!;
        const v = items[(i + 1) % items.length]!;
        const pu = enRiel(r, u.s);
        const pv = enRiel(r, v.s);
        if (largo(pu, pv) < SEPARACION) {
          // Vecinos en la lista: el de atrás retrocede y el de adelante avanza, así el orden no cambia.
          // El último y el primero se alejan por el camino corto: pueden estar cerca por la vuelta del riel o de frente.
          const delta = (((v.s - u.s) % total) + total) % total;
          const paso = i + 1 < items.length || delta <= total / 2 ? 0.25 : -0.25;
          u.s -= paso;
          v.s += paso;
          movio = true;
        }
      }
      if (!movio) break;
    }
    for (const { p, s } of items) puntos[p] = enRiel(r, s);
  }
  return puntos;
}

export const PUNTO_DE_PUERTA = calcular();

// Punto del borde de la forma más cercano a un rótulo, para la línea guía.
export const haciaRotulo = (id: CentroId): Punto => {
  const o = centro(FORMAS[id]);
  const r = ROTULOS[id];
  return r.desde ?? borde(FORMAS[id], Math.atan2(r.y - 4 - o.y, r.x - o.x)).punto;
};
