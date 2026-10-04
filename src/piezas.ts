// Qué fichas le tocan a una carta en cada capítulo. Sin contenido ni DOM: lo usan la app y el Worker de la IA.
import { CANALES, CENTROS, type CentroId } from "./engine/system-data";
import { DEL_TIPO } from "./engine/tipos";

// Lo que la carta le pide a cada capítulo. El Perfil va como "1/3"; `centros` son los definidos; `canales`, los definidos, como "1-8".
export interface Atributos { tipo: keyof typeof DEL_TIPO; autoridad: string; perfil: string; centros: CentroId[]; definicion: string; canales: string[] }
// Qué fichas y qué experimentos le tocan a esta carta en cada capítulo:
// 1, "Tu Tipo" (Tipo, Estrategia, Firma y No-Yo); 2, "Tu Autoridad" (qué la define y cómo decide); 3, "Tu Perfil" (sus dos Líneas y su ángulo);
// 4, "Tus Centros" (los nueve, cada uno en su estado, y la Definición); 5, "Tus Canales" (los definidos, o que no hay ninguno).
export function piezas(n: number, { tipo, autoridad, perfil, centros, definicion, canales }: Atributos): [string[], string[]] {
  const { estrategia } = DEL_TIPO[tipo];
  if (n === 1) return [[`tipo.${tipo}`, `estrategia.${estrategia}`, `firma_no_yo.${estrategia}`], [`experimento.${estrategia}`]];
  if (n === 2) return [[`autoridad.${autoridad}`, `autoridad_como.${autoridad}`], [`experimento.autoridad.${autoridad}`]];
  if (n === 4) {
    const ids = Object.keys(CENTROS) as CentroId[];
    const estados = ids.map((id) => `centro.${id}.${centros.includes(id) ? "definido" : "indefinido"}`);
    // Cada experimento pide elegir un Centro en ese estado: se ofrece solo si la carta tiene alguno.
    const experimentos = [...(centros.length < ids.length ? ["experimento.centro.indefinido"] : []), ...(centros.length ? ["experimento.centro.definido"] : [])];
    return [["centros.intro", ...estados, `definicion.${definicion}`], experimentos];
  }
  if (n === 5) return [["canales.intro", ...(canales.length ? canales.map((c) => `canal.${c}`) : ["canales.ninguno"])], canales.length ? ["experimento.canal"] : []];
  const [a, b] = perfil.split("/");
  // Ángulo Derecho, Yuxtaposición (solo el 4/1) o Ángulo Izquierdo, según la página oficial de Perfil.
  const grupo = perfil === "4/1" ? "yuxtaposicion" : ["5/1", "5/2", "6/2", "6/3"].includes(perfil) ? "izquierdo" : "derecho";
  return [["perfil.calculo", `linea.${a}`, `linea.${b}`, `perfil.grupo.${grupo}`], [`experimento.linea.${a}`, `experimento.linea.${b}`]];
}

const AUTORIDADES = ["emocional", "sacral", "esplenica", "ego_manifestado", "ego_proyectado", "autoproyectada", "mental", "lunar"];
const PERFILES = ["1/3", "1/4", "2/4", "2/5", "3/5", "3/6", "4/6", "4/1", "5/1", "5/2", "6/2", "6/3"];
const DEFINICIONES = ["ninguna", "simple", "partida", "triple", "cuadruple"];
const ID_CANALES = CANALES.map((c) => [...c.puertas].sort((a, b) => a - b).join("-"));

// Los atributos llegan de la app: solo se aceptan valores del catálogo, así no pueden llevar texto libre a un prompt (E3-guardas).
export function atributosValidos(x: unknown): Atributos | null {
  const a = x as Partial<Atributos> | null;
  const lista = (v: unknown, de: readonly string[]) => Array.isArray(v) && v.every((e) => typeof e === "string" && de.includes(e)) && new Set(v).size === v.length;
  if (!a || typeof a.tipo !== "string" || !(a.tipo in DEL_TIPO) || !AUTORIDADES.includes(a.autoridad as string) || !PERFILES.includes(a.perfil as string)) return null;
  if (!DEFINICIONES.includes(a.definicion as string) || !lista(a.centros, Object.keys(CENTROS)) || !lista(a.canales, ID_CANALES)) return null;
  return { tipo: a.tipo, autoridad: a.autoridad!, perfil: a.perfil!, centros: a.centros!, definicion: a.definicion!, canales: a.canales! };
}
