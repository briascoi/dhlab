// Revelación de la carta (DR10): pantalla previa con el botón para encender, encendido en secuencia de 6 a 8 s
// con "Saltar" y sonido opcional, y carta completa con una línea de cierre si la persona pidió menos movimiento.
import { t } from "../textos";
import { rotuloMapa } from "./mapa";
import { quieto } from "./movimiento";

export const DURACION = 7000;
const PASO = 320;

// Cuándo arranca cada paso para que el último termine justo en la duración total.
export const retrasos = (pasos: number, total = DURACION) => Array.from({ length: pasos }, (_, i) => (pasos > 1 ? (i * (total - PASO)) / (pasos - 1) : 0));

// Orden del encendido: los Centros definidos de a uno, los Canales de a uno y las filas del panel de a una.
function pasosDe(mapa: Element, panel: Element): Element[][] {
  const grupos: Element[][] = [];
  // En el SVG, la tinta de un Centro va antes que su luz, y cada cable antes que sus enchufes.
  for (const e of Array.from(mapa.querySelectorAll(".mapa-tinta, .mapa-trama, .mapa-halo, .mapa-luz, .mapa-cable, .mapa-enchufe"))) {
    if (e.matches(".mapa-tinta, .mapa-cable")) grupos.push([]);
    grupos.at(-1)!.push(e);
  }
  return [...grupos, ...Array.from(panel.querySelectorAll(".fila"), (f) => [f])];
}

// Clic de palanca sintetizado (propuesta a escuchar por Isma): un golpe corto de ruido que se apaga, filtrado.
function clic(audio: AudioContext) {
  const muestras = Math.floor(audio.sampleRate * 0.06);
  const ruido = audio.createBuffer(1, muestras, audio.sampleRate);
  const datos = ruido.getChannelData(0);
  for (let i = 0; i < muestras; i++) datos[i] = (Math.random() * 2 - 1) * Math.exp((-i / muestras) * 9);
  const fuente = audio.createBufferSource();
  fuente.buffer = ruido;
  const filtro = audio.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.frequency.value = 1700;
  const volumen = audio.createGain();
  volumen.gain.value = 0.35;
  fuente.connect(filtro).connect(volumen).connect(audio.destination);
  fuente.start();
}

function boton(clase: string, texto: string, alTocar: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = clase;
  b.textContent = texto;
  b.addEventListener("click", alTocar);
  return b;
}

export function revelar(contenedor: HTMLElement, mapa: SVGElement, panel: HTMLElement, alTerminar: () => void): void {
  const titulo = document.createElement("h2");
  titulo.className = "hoja-titulo";
  titulo.tabIndex = -1;
  titulo.textContent = t("revelacion.titulo");
  const previa = document.createElement("div");
  previa.className = "pantalla-hora";
  previa.append(titulo, boton("boton-principal", t("revelacion.encender"), encender));
  contenedor.replaceChildren(previa);
  titulo.focus();

  function encender() {
    contenedor.replaceChildren(rotuloMapa(), mapa);
    contenedor.after(panel);
    if (quieto()) {
      const cierre = document.createElement("p");
      cierre.className = "revelacion-cierre";
      cierre.textContent = t("revelacion.cierre");
      panel.after(cierre);
      return alTerminar();
    }
    const grupos = pasosDe(mapa, panel);
    const tiempos = retrasos(grupos.length);
    // El interruptor de sonido aparece al encender, apagado; cada paso suena solo si está prendido en ese momento.
    const audio = new AudioContext();
    void audio.resume(); // Safari lo crea suspendido aunque venga de un toque.
    const sonido = document.createElement("label");
    sonido.className = "sonido";
    const interruptor = document.createElement("input");
    interruptor.type = "checkbox";
    interruptor.setAttribute("role", "switch");
    sonido.append(interruptor, t("revelacion.sonido"));
    const relojes = tiempos.map((delay) => setTimeout(() => interruptor.checked && clic(audio), delay));
    const animaciones = tiempos.flatMap((delay, i) =>
      grupos[i]!.map((e) => {
        const opciones = { duration: PASO, delay, easing: "ease-out", fill: "backwards" as const };
        // Un Canal se conecta: el cable se dibuja de un conector al otro.
        if (!e.matches(".mapa-cable")) return e.animate([{ opacity: 0 }, { opacity: 1 }], opciones);
        e.setAttribute("pathLength", "1");
        return e.animate([{ opacity: 0, strokeDasharray: "1", strokeDashoffset: 1 }, { opacity: 1, offset: 0.1 }, { strokeDasharray: "1", strokeDashoffset: 0 }], opciones);
      }),
    );
    const saltear = boton("boton-secundario saltear", t("revelacion.saltear"), () => animaciones.forEach((a) => a.finish()));
    document.body.append(sonido, saltear);
    void Promise.all(animaciones.map((a) => a.finished)).then(() => {
      relojes.forEach(clearTimeout);
      void audio.close();
      sonido.remove();
      saltear.remove();
      alTerminar();
    });
  }
}
