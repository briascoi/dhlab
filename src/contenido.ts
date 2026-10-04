// Contenido de los capítulos: fichas con fuente y experimentos. Vive en `contenido/`, fuera del código publicado;
// sin esa carpeta la app compila igual y el Libro queda sin capítulos.
import { piezas, type Atributos } from "./piezas";
export type { Atributos } from "./piezas";

export interface Fuente { marca: string; obra: string; autor: string; donde: string }
export interface Ficha {
  id: string;
  tema: string;
  texto: string;
  fuentes: Fuente[];
  aprobado_por: string;
  fecha_aprobacion: string;
  version: number;
  originalidad_chequeada: boolean;
  borrador_asistido: boolean;
  clase?: "experimento" | "observacion";
}
interface Capitulo { capitulo: number; fichas: Ficha[]; experimentos: Ficha[] }

const capitulos = Object.values(import.meta.glob<Capitulo>("../contenido/capitulo-*.json", { eager: true, import: "default" }));

// Una ficha sin la aprobación de Isma o sin el chequeo de originalidad se muestra, pero marcada como borrador.
export const revisada = (f: Ficha) => f.aprobado_por !== "" && f.originalidad_chequeada;

// Cuántos capítulos tienen contenido; se abren en orden, cada uno al completar el anterior (plan, "Mapa de capítulos").
export const ESCRITOS = capitulos.length ? Math.max(...capitulos.map((c) => c.capitulo)) : 0;

export function capitulo(n: number, atributos: Atributos): { fichas: Ficha[]; experimentos: Ficha[] } | null {
  const c = capitulos.find((x) => x.capitulo === n);
  if (!c) return null;
  const [fichas, experimentos] = piezas(n, atributos);
  return { fichas: fichas.flatMap((id) => c.fichas.filter((f) => f.id === id)), experimentos: c.experimentos.filter((e) => experimentos.includes(e.id) || e.clase === "observacion") };
}

// Lo que se guarda de un capítulo en el Libro: qué se eligió, cuándo, a qué atributo se refiere (R12), qué versión de cada ficha se leyó
// y las respuestas de los chequeos de los días 3 y 7 (DR11).
export type Respuesta = "me_representa" | "no_me_representa" | "no_probe";
export interface EstadoCapitulo {
  esquema: 1;
  experimento: string;
  elegido: string;
  atributo: string;
  fichas: { id: string; version: number }[];
  chequeos?: { dia: 3 | 7; respuesta: Respuesta; fecha: string }[];
}

// Qué chequeo toca hoy: el del día 3 entre el día 3 y el 6, y el del día 7 desde el 7. El del día 7 cierra el experimento.
export function chequeoPendiente(estado: EstadoCapitulo, ahora = Date.now()): 3 | 7 | null {
  const dias = Math.floor((ahora - Date.parse(estado.elegido)) / 86_400_000);
  const hecho = (dia: number) => (estado.chequeos ?? []).some((c) => c.dia === dia);
  if (dias >= 7) return hecho(7) ? null : 7;
  return dias >= 3 && !hecho(3) ? 3 : null;
}
export const cierre = (estado: EstadoCapitulo) => (estado.chequeos ?? []).find((c) => c.dia === 7);
