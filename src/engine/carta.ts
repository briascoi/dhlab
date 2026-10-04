// La carta: 13 activaciones de Personalidad (el nacimiento) y 13 de Diseño (cuando el Sol estaba 88° antes).
import type { Tipo } from "./tipos";
import { definicion } from "./definicion";
import { CUERPOS, diaJuliano, instanteDe, longitudSol, posiciones, type Cuerpo, type Nodo } from "./efemerides";
import { activacion, normalizar, type Activacion } from "./rueda";
import type { Canal, CentroId } from "./system-data";

export const GRADOS_DISENO = 88;
export type { Tipo } from "./tipos";
// Las ocho Autoridades, con la taxonomía de Jovian Archive (docs/diseno-humano/base-de-conocimiento.md).
export type Autoridad = "emocional" | "sacral" | "esplenica" | "ego_manifestado" | "ego_proyectado" | "autoproyectada" | "mental" | "lunar";
export type Definicion = "ninguna" | "simple" | "partida" | "triple" | "cuadruple";

export interface Carta {
  nacimiento: Date;
  diseno: Date;
  nodo: Nodo;
  personalidad: Record<Cuerpo, Activacion>;
  disenoActivaciones: Record<Cuerpo, Activacion>;
  puertas: number[];
  canales: Canal[];
  centros: CentroId[];
  tipo: Tipo;
  autoridad: Autoridad;
  perfil: [number, number];
  definicion: Definicion;
}

// Día juliano en que el Sol estaba 88° de longitud antes que en el nacimiento, por bisección.
export function diaDeDiseno(djNacimiento: number): number {
  const objetivo = normalizar(longitudSol(djNacimiento) - GRADOS_DISENO);
  // Diferencia con signo, en (-180, 180]: negativa antes del momento buscado, positiva después.
  const diferencia = (dj: number) => ((longitudSol(dj) - objetivo + 540) % 360) - 180;
  // El Sol recorre entre 0,95° y 1,02° por día: 88° le llevan entre 86 y 93 días.
  let antes = djNacimiento - 96;
  let despues = djNacimiento - 84;
  for (let i = 0; i < 60; i++) {
    const medio = (antes + despues) / 2;
    if (diferencia(medio) < 0) antes = medio;
    else despues = medio;
  }
  return (antes + despues) / 2;
}

const MOTORES: CentroId[] = ["sacral", "corazon", "plexo", "raiz"];

// Grupos de Centros unidos entre sí por Canales definidos.
export function grupos(canales: Canal[]): CentroId[][] {
  const resultado: CentroId[][] = [];
  for (const { centros: [a, b] } of canales) {
    const tocados = resultado.filter((g) => g.includes(a) || g.includes(b));
    const unido = [...new Set([...tocados.flat(), a, b])];
    for (const g of tocados) resultado.splice(resultado.indexOf(g), 1);
    resultado.push(unido);
  }
  return resultado;
}

export function tipoDe(canales: Canal[]): Tipo {
  const g = grupos(canales);
  if (g.length === 0) return "reflector";
  const sacral = g.some((x) => x.includes("sacral"));
  // Un motor llega a la Garganta si está en su mismo grupo.
  const motorAGarganta = g.some((x) => x.includes("garganta") && MOTORES.some((m) => x.includes(m)));
  if (sacral) return motorAGarganta ? "generador_manifestante" : "generador";
  return motorAGarganta ? "manifestador" : "proyector";
}

// La Autoridad sale del primer Centro definido en este orden: Plexo Solar, Sacral, Bazo, Corazón y G unido a la Garganta.
// Sin ninguno: mental (Proyectores con definición solo de la Garganta para arriba) o lunar (Reflectores).
// Fuentes: páginas de Autoridad de Jovian Archive y SharpAstrology.HumanDesign (MIT), DataModels/HumanDesignChart.cs,
// leídas el 2026-10-03; las dos dan la misma regla.
export function autoridadDe(canales: Canal[]): Autoridad {
  const g = grupos(canales);
  const definido = (centro: CentroId) => g.some((x) => x.includes(centro));
  if (definido("plexo")) return "emocional";
  if (definido("sacral")) return "sacral";
  if (definido("bazo")) return "esplenica";
  // Con el Corazón definido y sin los tres anteriores solo quedan Manifestadores (Corazón a la Garganta) y Proyectores (Corazón al G).
  if (definido("corazon")) return tipoDe(canales) === "manifestador" ? "ego_manifestado" : "ego_proyectado";
  if (g.some((x) => x.includes("g") && x.includes("garganta"))) return "autoproyectada";
  return g.length === 0 ? "lunar" : "mental";
}

const DEFINICIONES: Definicion[] = ["ninguna", "simple", "partida", "triple", "cuadruple"];

export function calcularCarta(nacimiento: Date, nodo: Nodo = "verdadero"): Carta {
  const dj = diaJuliano(nacimiento);
  const djDiseno = diaDeDiseno(dj);
  const activar = (p: Record<Cuerpo, number>) => Object.fromEntries(CUERPOS.map((c) => [c, activacion(p[c])])) as Record<Cuerpo, Activacion>;
  const personalidad = activar(posiciones(dj, nodo));
  const disenoActivaciones = activar(posiciones(djDiseno, nodo));
  const puertas = [...new Set([...Object.values(personalidad), ...Object.values(disenoActivaciones)].map((a) => a.puerta))].sort((a, b) => a - b);
  const { canales, centros } = definicion(puertas);
  return {
    nacimiento,
    diseno: instanteDe(djDiseno),
    nodo,
    personalidad,
    disenoActivaciones,
    puertas,
    canales,
    centros: [...centros],
    tipo: tipoDe(canales),
    autoridad: autoridadDe(canales),
    perfil: [personalidad.sol.linea, disenoActivaciones.sol.linea],
    definicion: DEFINICIONES[grupos(canales).length]!,
  };
}
