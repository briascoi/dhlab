// Hora incierta (T15): qué cartas distintas aparecen dentro de un rango de tiempo.
// Se recorre el rango cada 10 minutos y cada cambio se afina por bisección hasta el segundo.
import { calcularCarta, type Autoridad, type Carta, type Definicion, type Tipo } from "./carta";
import type { Nodo } from "./efemerides";

const PASO = 10 * 60_000;

export interface Tramo<T> {
  desde: number;
  hasta: number;
  valor: T;
}

// Recorre [inicio, fin] y devuelve los tramos en los que la firma no cambia. Compara cada muestra con la anterior,
// así que un valor que cambia y más tarde vuelve al inicial queda como tres tramos, no como uno.
export function barrer<T>(inicio: number, fin: number, calcular: (t: number) => T, firma: (v: T) => string, paso = PASO): Tramo<T>[] {
  let actual = calcular(inicio);
  const tramos: Tramo<T>[] = [{ desde: inicio, hasta: fin, valor: actual }];
  for (let t = inicio; t < fin; ) {
    const siguiente = Math.min(t + paso, fin);
    let valor = calcular(siguiente);
    if (firma(valor) !== firma(actual)) {
      // Bisección: el último instante con la firma anterior y el primero con una distinta.
      let a = t;
      let b = siguiente;
      while (b - a > 1000) {
        const medio = Math.floor((a + b) / 2);
        const v = calcular(medio);
        if (firma(v) === firma(actual)) a = medio;
        else {
          b = medio;
          valor = v;
        }
      }
      tramos[tramos.length - 1]!.hasta = b;
      tramos.push({ desde: b, hasta: fin, valor });
      actual = valor;
      t = b;
    } else t = siguiente;
  }
  return tramos;
}

// Dos cartas son distintas si algún cuerpo activa otra Puerta o si cambia la Línea de alguno de los dos Soles.
export const firmaDeCarta = (c: Carta) =>
  [...Object.values(c.personalidad), ...Object.values(c.disenoActivaciones)].map((a) => a.puerta).join(",") + `|${c.perfil.join("/")}`;

export interface Analisis {
  // "estable": una sola carta en todo el rango. "incierta": cambian piezas menores (Perfil, Canales, Centros).
  // "pendiente_de_hora": cambia el Tipo o la Autoridad, y hasta confirmar la hora no se abren capítulos (plan, "Datos de nacimiento inciertos").
  estado: "estable" | "incierta" | "pendiente_de_hora";
  tramos: Tramo<Carta>[];
  tipos: Tipo[];
  autoridades: Autoridad[];
  perfiles: string[];
  definiciones: Definicion[];
  // Puertas que están en algunas de las cartas posibles pero no en todas.
  puertasInciertas: number[];
}

export function analizarRango(inicio: Date, fin: Date, nodo: Nodo = "verdadero"): Analisis {
  const tramos = barrer(inicio.getTime(), fin.getTime(), (t) => calcularCarta(new Date(t), nodo), firmaDeCarta);
  const cartas = tramos.map((t) => t.valor);
  const unicos = <T>(xs: T[]) => [...new Set(xs)];
  const tipos = unicos(cartas.map((c) => c.tipo));
  const autoridades = unicos(cartas.map((c) => c.autoridad));
  const todas = unicos(cartas.flatMap((c) => c.puertas));
  const puertasInciertas = todas.filter((p) => !cartas.every((c) => c.puertas.includes(p))).sort((a, b) => a - b);
  return {
    estado: tipos.length > 1 || autoridades.length > 1 ? "pendiente_de_hora" : tramos.length > 1 ? "incierta" : "estable",
    tramos,
    tipos,
    autoridades,
    perfiles: unicos(cartas.map((c) => c.perfil.join("/"))),
    definiciones: unicos(cartas.map((c) => c.definicion)),
    puertasInciertas,
  };
}
