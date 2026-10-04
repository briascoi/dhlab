// Trazos a mano para las anotaciones (DR13): flechas curvas, subrayados, sellos y manchas. Dibujo propio: cada trazo se genera
// con una semilla, así tiene el pulso irregular de una fibra y sale siempre igual. Devuelven el atributo `d` de un <path>.
export type Punto = { x: number; y: number };
// El pulso acompaña a la tipografía manuscrita elegida: grosor del trazo y cuánto tiembla la mano.
export interface Pulso { grosor: number; temblor: number }

// Un decimal, sin "-0.0".
const n = (v: number) => (Math.round(v * 10) / 10 + 0).toFixed(1);
const azar = (semilla: number) => () => (semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296;

// Une los puntos con curvas suaves (cada punto es control y los puntos medios son los nudos), con temblor en los del medio.
function trazo(puntos: Punto[], temblor: number, r: () => number, cerrado = false): string {
  const p = puntos.map((q, i) => (cerrado || (i > 0 && i < puntos.length - 1) ? { x: q.x + (r() - 0.5) * 2 * temblor, y: q.y + (r() - 0.5) * 2 * temblor } : q));
  const medio = (a: Punto, b: Punto) => `${n((a.x + b.x) / 2)},${n((a.y + b.y) / 2)}`;
  const c = (q: Punto) => `${n(q.x)},${n(q.y)}`;
  if (cerrado) return `M${medio(p.at(-1)!, p[0]!)}` + p.map((q, i) => ` Q${c(q)} ${medio(q, p[(i + 1) % p.length]!)}`).join("") + "Z";
  let d = `M${c(p[0]!)}`;
  for (let i = 1; i < p.length - 1; i++) d += ` Q${c(p[i]!)} ${i === p.length - 2 ? c(p[i + 1]!) : medio(p[i]!, p[i + 1]!)}`;
  return d;
}

// Formas de flecha en un marco de 0 a 1 (ninguna es recta): arco, gancho que arranca de costado, rulo con una vuelta y ese.
const FORMAS = {
  arco: (t: number) => ({ x: t, y: -0.32 * Math.sin(Math.PI * t) }),
  gancho: (t: number) => ({ x: t ** 1.6, y: -0.55 * Math.sin(Math.PI * t ** 0.55) * (1 - t * 0.35) }),
  rulo: (t: number) => ({ x: t + 0.2 * Math.sin(2 * Math.PI * t), y: -0.2 * (1 - Math.cos(2 * Math.PI * t)) - 0.12 * Math.sin(Math.PI * t) }),
  ese: (t: number) => ({ x: t, y: 0.24 * Math.sin(2 * Math.PI * t) }),
} as const;
export type FormaDeFlecha = keyof typeof FORMAS;

// Flecha a mano de `desde` a `hasta`: el cuerpo curvo y la punta, dos rayitas abiertas (no un triángulo). `lado` invierte la panza.
export function flecha(forma: FormaDeFlecha, desde: Punto, hasta: Punto, pulso: Pulso, semilla = 1, lado: 1 | -1 = 1): { cuerpo: string; punta: string } {
  const r = azar(semilla);
  const dx = hasta.x - desde.x;
  const dy = hasta.y - desde.y;
  const largo = Math.hypot(dx, dy);
  const pasos = forma === "rulo" ? 18 : 9;
  const puntos = Array.from({ length: pasos + 1 }, (_, i) => {
    const { x, y } = FORMAS[forma](i / pasos);
    return { x: desde.x + dx * x - dy * y * lado, y: desde.y + dy * x + dx * y * lado };
  });
  // La punta sigue la dirección con la que llega el trazo, con sus dos rayitas de distinto largo.
  const antes = puntos.at(-2)!;
  const angulo = Math.atan2(hasta.y - antes.y, hasta.x - antes.x);
  const ala = (giro: number, medida: number) => ({ x: hasta.x - Math.cos(angulo + giro) * medida, y: hasta.y - Math.sin(angulo + giro) * medida });
  const medida = Math.max(9, Math.min(16, largo * 0.16)) + pulso.grosor;
  const c = (q: Punto) => `${n(q.x)},${n(q.y)}`;
  return {
    cuerpo: trazo(puntos, pulso.temblor, r),
    punta: `M${c(ala(0.5 + r() * 0.15, medida))} L${c(hasta)} L${c(ala(-0.42 - r() * 0.15, medida * (0.8 + r() * 0.3)))}`,
  };
}

// Subrayado de ida y vuelta, apenas inclinado.
export function subrayado(desde: Punto, ancho: number, pulso: Pulso, semilla = 1): string {
  const r = azar(semilla);
  const linea = (y: number, de: number, a: number) => Array.from({ length: 6 }, (_, i) => ({ x: desde.x + de + ((a - de) * i) / 5, y: desde.y + y + Math.sin(i * 1.3) * 1.2 - (i * ancho) / 300 }));
  return `${trazo(linea(0, 0, ancho), pulso.temblor, r)} ${trazo(linea(pulso.grosor * 1.8, ancho * 0.94, ancho * 0.12), pulso.temblor, r)}`;
}

// Sello en estallido: una estrella de puntas desparejas.
export function estallido(centro: Punto, radio: number, puntas = 13, semilla = 1): string {
  const r = azar(semilla);
  return (
    Array.from({ length: puntas * 2 }, (_, i) => {
      const a = (i * Math.PI) / puntas + (r() - 0.5) * 0.12;
      const largo = radio * (i % 2 ? 0.76 + r() * 0.06 : 0.94 + r() * 0.12);
      return `${i ? "L" : "M"}${n(centro.x + Math.cos(a) * largo * 1.25)},${n(centro.y + Math.sin(a) * largo)}`;
    }).join(" ") + "Z"
  );
}

// Mancha de tinta: un contorno blando e irregular.
export function mancha(centro: Punto, radio: number, semilla = 1): string {
  const r = azar(semilla);
  const puntos = Array.from({ length: 9 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 9;
    const largo = radio * (0.82 + r() * 0.36);
    return { x: centro.x + Math.cos(a) * largo * 1.2, y: centro.y + Math.sin(a) * largo };
  });
  return trazo(puntos, 0, r, true);
}

// Contorno a pulso de una pieza: cada lado en tres tramos, con los puntos apenas corridos. Con otra semilla sale otra variante
// del mismo contorno; alternarlas es la "tinta que respira" (DESIGN.md, Motion).
export function contorno(forma: Punto[], temblor: number, semilla = 1): string {
  const r = azar(semilla);
  const puntos = forma.flatMap((a, i) => {
    const b = forma[(i + 1) % forma.length]!;
    return [0, 1, 2].map((k) => `${n(a.x + ((b.x - a.x) * k) / 3 + (r() - 0.5) * temblor * (k ? 2 : 1))},${n(a.y + ((b.y - a.y) * k) / 3 + (r() - 0.5) * temblor * (k ? 2 : 1))}`);
  });
  return `M${puntos.join("L")}Z`;
}
