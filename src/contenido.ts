// Contenido de los capítulos: fichas con fuente y experimentos. Vive en `contenido/`, fuera del código publicado;
// sin esa carpeta la app compila igual y el Libro queda sin capítulos.
import { DEL_TIPO } from "./engine/tipos";

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

// Lo que la carta le pide a cada capítulo. El Perfil va como "1/3".
export interface Atributos { tipo: keyof typeof DEL_TIPO; autoridad: string; perfil: string }
// Cuántos capítulos tienen contenido; se abren en orden, cada uno al completar el anterior (plan, "Mapa de capítulos").
export const ESCRITOS = capitulos.length ? Math.max(...capitulos.map((c) => c.capitulo)) : 0;

// Qué fichas y qué experimentos le tocan a esta carta en cada capítulo:
// 1, "Tu Tipo" (Tipo, Estrategia, Firma y No-Yo); 2, "Tu Autoridad" (qué la define y cómo decide); 3, "Tu Perfil" (sus dos Líneas y su ángulo).
function piezas(n: number, { tipo, autoridad, perfil }: Atributos): [string[], string[]] {
  const { estrategia } = DEL_TIPO[tipo];
  if (n === 1) return [[`tipo.${tipo}`, `estrategia.${estrategia}`, `firma_no_yo.${estrategia}`], [`experimento.${estrategia}`]];
  if (n === 2) return [[`autoridad.${autoridad}`, `autoridad_como.${autoridad}`], [`experimento.autoridad.${autoridad}`]];
  const [a, b] = perfil.split("/");
  // Ángulo Derecho, Yuxtaposición (solo el 4/1) o Ángulo Izquierdo, según la página oficial de Perfil.
  const grupo = perfil === "4/1" ? "yuxtaposicion" : ["5/1", "5/2", "6/2", "6/3"].includes(perfil) ? "izquierdo" : "derecho";
  return [["perfil.calculo", `linea.${a}`, `linea.${b}`, `perfil.grupo.${grupo}`], [`experimento.linea.${a}`, `experimento.linea.${b}`]];
}

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
