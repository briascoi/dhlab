// Niveles de movimiento (DESIGN.md, Motion): completo (las cuatro clases), suave (sin movimiento en reposo) y mínimo (cortes directos).
// El nivel elegido se guarda en el dispositivo y va como `data-mov` en la raíz, de donde lo lee el CSS.
const CLAVE = "dhlab.movimiento";
export const NIVELES = ["completo", "suave", "minimo"] as const;
export type Movimiento = (typeof NIVELES)[number];

// Sin elección guardada, "reducir movimiento" del sistema arranca en mínimo.
export const nivelInicial = (guardado: string | null, reducir: boolean): Movimiento => (NIVELES.includes(guardado as Movimiento) ? (guardado as Movimiento) : reducir ? "minimo" : "completo");
export const nivelActual = (): Movimiento => nivelInicial(localStorage.getItem(CLAVE), matchMedia("(prefers-reduced-motion: reduce)").matches);

export function aplicarMovimiento(nivel: Movimiento = nivelActual()) {
  document.documentElement.dataset.mov = nivel;
}
export function guardarMovimiento(nivel: Movimiento) {
  localStorage.setItem(CLAVE, nivel);
  aplicarMovimiento(nivel);
}
export const quieto = () => (document.documentElement.dataset.mov ?? nivelActual()) === "minimo";

// Rebote para lo que se enchufa, gira o se sella.
export const REBOTE = "cubic-bezier(.3,1.6,.5,1)";
// Un movimiento que solo vale mientras dura: al terminar, el elemento vuelve a su forma quieta. En mínimo no hace nada.
export const anima = (e: Element | null | undefined, cuadros: Keyframe[], opciones: KeyframeAnimationOptions) => (e && !quieto() ? e.animate(cuadros, { easing: "ease-out", fill: "backwards", ...opciones }) : undefined);
