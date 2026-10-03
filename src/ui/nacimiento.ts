import "./cuenta.css";
import "./nacimiento.css";
import { t, type TextoId } from "../textos";

// Formulario de nacimiento (DR1): fecha, hora con su confiabilidad y lugar, más el país donde vive hoy (DR23).
// Las localidades salen de un archivo por país (R10); nunca se consulta una API externa con la ciudad.

export type Ciudad = [nombre: string, provincia: string, latitud: number, longitud: number, huso: string];
export type Confiabilidad = "exacta" | "aproximada" | "desconocida";
export interface Nacimiento {
  fecha: string;
  hora: string;
  confiabilidad: Confiabilidad;
  margen: number;
  pais: string;
  ciudad: Ciudad | null;
  residencia: string;
}

const CLAVE = "dhlab.nacimiento";
const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

// Primero las que empiezan con lo escrito, después las que lo contienen.
export function buscarCiudades(lista: Ciudad[], consulta: string, maximo = 8): Ciudad[] {
  const q = sinTildes(consulta);
  if (q.length < 2) return [];
  const empiezan: Ciudad[] = [];
  const contienen: Ciudad[] = [];
  for (const c of lista) {
    const n = sinTildes(c[0]);
    if (n.startsWith(q)) empiezan.push(c);
    else if (n.includes(q)) contienen.push(c);
  }
  return [...empiezan, ...contienen].slice(0, maximo);
}

export function errorDePaso(paso: number, d: Nacimiento, hoy = new Date().toISOString().slice(0, 10)): TextoId | null {
  if (paso === 1 && (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) || d.fecha > hoy)) return "nacimiento.fecha.error";
  if (paso === 2 && d.confiabilidad !== "desconocida" && !/^\d{2}:\d{2}$/.test(d.hora)) return "nacimiento.hora.error";
  if (paso === 3 && !d.ciudad) return "nacimiento.lugar.error";
  return null;
}

type Hijo = Node | string | false | null | undefined;
function h<K extends keyof HTMLElementTagNameMap>(etiqueta: K, attrs: Record<string, string> = {}, ...hijos: Hijo[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...hijos.filter((x): x is Node | string => Boolean(x)));
  return e;
}

// pasoInicial permite volver directo a la hora cuando hay que corregirla.
export function abrirNacimiento(contenedor: HTMLElement, alTerminar: (datos: Nacimiento) => void, pasoInicial = 1): void {
  const region = new Intl.Locale(navigator.language).maximize().region ?? "";
  let d: Nacimiento = { fecha: "", hora: "", confiabilidad: "exacta", margen: 15, pais: region, ciudad: null, residencia: region };
  try {
    d = { ...d, ...(JSON.parse(localStorage.getItem(CLAVE) ?? "{}") as Partial<Nacimiento>) };
  } catch {
    // Sin almacenamiento se empieza de cero.
  }
  const guardar = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(d));
    } catch {
      // El formulario funciona igual sin guardar el borrador.
    }
  };
  const nombres = new Intl.DisplayNames(["es"], { type: "region" });
  let paises: string[] = [];
  const ciudades = new Map<string, Promise<Ciudad[]>>();
  const cargar = (pais: string) => {
    if (!ciudades.has(pais)) ciudades.set(pais, fetch(`/ciudades/${pais}.json`).then((r) => (r.ok ? (r.json() as Promise<Ciudad[]>) : [])).catch(() => []));
    return ciudades.get(pais)!;
  };
  const selectPais = (id: string, valor: string) => {
    const s = h("select", { id, class: "campo" });
    const orden = [...paises].sort((a, b) => (nombres.of(a) ?? a).localeCompare(nombres.of(b) ?? b, "es"));
    for (const p of orden) s.append(h("option", { value: p }, nombres.of(p) ?? p));
    s.value = valor;
    return s;
  };

  function pintar(paso: number) {
    const error = h("p", { class: "error", role: "alert", id: "nacimiento-error" });
    const titulos: TextoId[] = ["nacimiento.fecha.titulo", "nacimiento.hora.titulo", "nacimiento.lugar.titulo"];
    const titulo = h("h2", { class: "hoja-titulo", tabindex: "-1" }, t(titulos[paso - 1]!));
    const campos = h("div", { class: "campos" });

    if (paso === 1) {
      const fecha = h("input", { id: "nac-fecha", type: "date", class: "campo", value: d.fecha, max: new Date().toISOString().slice(0, 10), "aria-describedby": "nacimiento-error" });
      fecha.addEventListener("input", () => (d.fecha = fecha.value));
      campos.append(h("p", { class: "promesa" }, t("nacimiento.promesa")), h("label", { for: "nac-fecha", class: "rotulo-campo" }, t("nacimiento.fecha.rotulo")), fecha);
    }

    if (paso === 2) {
      const hora = h("input", { id: "nac-hora", type: "time", class: "campo", value: d.hora, "aria-describedby": "nacimiento-error" });
      hora.addEventListener("input", () => (d.hora = hora.value));
      const margen = h("input", { id: "nac-margen", type: "number", class: "campo", min: "1", max: "720", inputmode: "numeric", value: String(d.margen) });
      margen.addEventListener("input", () => (d.margen = Math.max(1, Number(margen.value) || 1)));
      const filaMargen = h("div", { class: "campos" }, h("label", { for: "nac-margen", class: "rotulo-campo" }, t("nacimiento.hora.margen")), margen);
      const grupo = h("fieldset", { class: "opciones" }, h("legend", { class: "rotulo-campo" }, t("nacimiento.hora.confiabilidad")));
      const ajustar = () => {
        filaMargen.hidden = d.confiabilidad !== "aproximada";
        hora.disabled = d.confiabilidad === "desconocida";
      };
      for (const valor of ["exacta", "aproximada", "desconocida"] as const) {
        const radio = h("input", { type: "radio", name: "confiabilidad", value: valor });
        radio.checked = d.confiabilidad === valor;
        radio.addEventListener("change", () => {
          d.confiabilidad = valor;
          ajustar();
        });
        grupo.append(h("label", { class: "opcion" }, radio, h("span", {}, t(`nacimiento.hora.${valor}`))));
      }
      ajustar();
      campos.append(h("label", { for: "nac-hora", class: "rotulo-campo" }, t("nacimiento.hora.rotulo")), hora, grupo, filaMargen);
    }

    if (paso === 3) {
      const pais = selectPais("nac-pais", d.pais);
      const ciudad = h("input", { id: "nac-ciudad", type: "text", class: "campo", autocomplete: "off", role: "combobox", "aria-controls": "nac-resultados", "aria-expanded": "false", "aria-describedby": "nacimiento-error", value: d.ciudad ? `${d.ciudad[0]}, ${d.ciudad[1]}` : "" });
      const resultados = h("ul", { id: "nac-resultados", class: "resultados", role: "listbox" });
      const estado = h("p", { class: "espera", "aria-live": "polite" });
      const residencia = selectPais("nac-residencia", d.residencia);
      const buscar = async () => {
        d.ciudad = null;
        resultados.replaceChildren();
        if (ciudad.value.trim().length < 2) return void (estado.textContent = "");
        estado.textContent = t("nacimiento.lugar.cargando");
        const lista = buscarCiudades(await cargar(pais.value), ciudad.value);
        estado.textContent = lista.length ? "" : t("nacimiento.lugar.sin_resultados");
        ciudad.setAttribute("aria-expanded", String(lista.length > 0));
        for (const c of lista) {
          const opcion = h("button", { type: "button", class: "resultado", role: "option" }, `${c[0]}, ${c[1]}`);
          opcion.addEventListener("click", () => {
            d.ciudad = c;
            ciudad.value = `${c[0]}, ${c[1]}`;
            resultados.replaceChildren();
            ciudad.setAttribute("aria-expanded", "false");
            residencia.focus();
          });
          resultados.append(h("li", { role: "presentation" }, opcion));
        }
      };
      ciudad.addEventListener("input", () => void buscar());
      pais.addEventListener("change", () => {
        d.pais = pais.value;
        ciudad.value = "";
        void buscar();
        void cargar(pais.value);
      });
      residencia.addEventListener("change", () => (d.residencia = residencia.value));
      void cargar(pais.value);
      campos.append(
        h("label", { for: "nac-pais", class: "rotulo-campo" }, t("nacimiento.lugar.pais")),
        pais,
        h("label", { for: "nac-ciudad", class: "rotulo-campo" }, t("nacimiento.lugar.ciudad")),
        ciudad,
        estado,
        resultados,
        h("label", { for: "nac-residencia", class: "rotulo-campo" }, t("nacimiento.residencia.rotulo")),
        residencia,
        h("p", { class: "espera" }, t("nacimiento.residencia.ayuda")),
      );
    }

    const seguir = h("button", { type: "submit", class: "boton-principal" }, t(paso === 3 ? "nacimiento.listo" : "nacimiento.siguiente"));
    const volver = paso > 1 && h("button", { type: "button", class: "boton-secundario" }, t("comun.volver"));
    if (volver) volver.addEventListener("click", () => pintar(paso - 1));
    const formulario = h("form", { class: "nacimiento", novalidate: "" }, h("p", { class: "rotulo" }, t("nacimiento.paso", { n: paso })), titulo, campos, error, h("div", { class: "acciones" }, volver, seguir));
    formulario.addEventListener("submit", (e) => {
      e.preventDefault();
      const falla = errorDePaso(paso, d);
      if (falla) {
        error.textContent = t(falla);
        return formulario.querySelector<HTMLElement>(".campo:not(:disabled)")?.focus();
      }
      guardar();
      if (paso < 3) return pintar(paso + 1);
      alTerminar(d);
    });
    contenedor.replaceChildren(formulario);
    titulo.focus();
  }

  fetch("/ciudades/indice.json")
    .then((r) => r.json() as Promise<Record<string, number>>)
    .then((indice) => {
      paises = Object.keys(indice);
      if (!paises.includes(d.pais)) d.pais = paises.includes("ES") ? "ES" : paises[0]!;
      if (!paises.includes(d.residencia)) d.residencia = d.pais;
      pintar(pasoInicial);
    })
    .catch(() => {
      paises = [];
      pintar(pasoInicial);
    });
}
