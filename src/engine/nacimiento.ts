// De los datos del formulario al rango de instantes que hay que calcular, según la confiabilidad de la hora.
import { aUtc } from "./time";

const MIN = 60_000;
// "Cerca del límite": una hora exacta se recalcula con ±5 minutos (plan, "Datos de nacimiento inciertos").
export const MARGEN_EXACTA = 5;

export interface DatosHora {
  fecha: string;
  hora: string;
  confiabilidad: "exacta" | "aproximada" | "desconocida";
  margen: number;
  huso: string;
}

export type Rango =
  | { estado: "listo"; centro: Date; inicio: Date; fin: Date }
  // La hora no existió o se repitió: hay que preguntarle a la persona antes de calcular.
  | { estado: "inexistente" | "repetida"; opciones: Date[] };

export function rangoDeNacimiento({ fecha, hora, confiabilidad, margen, huso }: DatosHora): Rango {
  if (confiabilidad === "desconocida") {
    // Todo el día local: desde las 00:00 hasta las 00:00 del día siguiente.
    const siguiente = new Date(Date.parse(`${fecha}T00:00:00Z`) + 24 * 60 * MIN).toISOString().slice(0, 10);
    const inicio = aUtc(fecha, "00:00", huso).instantes[0] ?? aUtc(fecha, "01:00", huso).instantes[0]!;
    const fin = aUtc(siguiente, "00:00", huso).instantes[0] ?? aUtc(siguiente, "01:00", huso).instantes[0]!;
    return { estado: "listo", centro: new Date((inicio.getTime() + fin.getTime()) / 2), inicio, fin };
  }
  const local = aUtc(fecha, hora, huso);
  if (local.estado !== "unica") return { estado: local.estado, opciones: local.instantes };
  const centro = local.instantes[0]!;
  const m = (confiabilidad === "aproximada" ? margen : MARGEN_EXACTA) * MIN;
  return { estado: "listo", centro, inicio: new Date(centro.getTime() - m), fin: new Date(centro.getTime() + m) };
}
