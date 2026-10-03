// Recursos de impresión para dar a los dibujos el aspecto de una risografía, sin imágenes: se insertan una sola vez en la página
// y se usan desde el CSS con `filter: url(#...)`, `fill: url(#...)` y `mask: url(#...)`. Son estáticos (sin animación).
// - #pulso: desplaza apenas cada trazo con ruido, para que el borde no sea una recta perfecta (tinta a mano).
// - #riso: le saca motas a la tinta plana, como una tinta que no cubre del todo el papel.
// - #pulso-caja y #riso-caja: lo mismo, para piezas de la interfaz (etiquetas, perillas, pestaña activa), medidos sobre su propia caja.
// - #semitono y #caida: trama de puntos que crece hacia abajo a la derecha, para sombrear sin degradado.
const DEFS = `
<filter id="pulso" filterUnits="userSpaceOnUse" x="0" y="0" width="500" height="590">
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="4" result="ruido"/>
  <feDisplacementMap in="SourceGraphic" in2="ruido" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="riso" filterUnits="userSpaceOnUse" x="0" y="0" width="500" height="590">
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="grano"/>
  <feColorMatrix in="grano" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -11 7.4" result="motas"/>
  <feComposite in="SourceGraphic" in2="motas" operator="in" result="tinta"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="9" result="ruido"/>
  <feDisplacementMap in="tinta" in2="ruido" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="pulso-caja" x="-6%" y="-12%" width="112%" height="124%">
  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="6" result="ruido"/>
  <feDisplacementMap in="SourceGraphic" in2="ruido" scale="3" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<filter id="riso-caja" x="-4%" y="-8%" width="108%" height="116%">
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="13" result="grano"/>
  <feColorMatrix in="grano" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -11 7.4" result="motas"/>
  <feComposite in="SourceGraphic" in2="motas" operator="in" result="tinta"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="5" result="ruido"/>
  <feDisplacementMap in="tinta" in2="ruido" scale="3" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<pattern id="semitono" width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
  <circle cx="2.3" cy="2.3" r="1.15"/>
</pattern>
<linearGradient id="caida" x1="0.15" y1="0" x2="0.9" y2="1">
  <stop offset="0.3" stop-color="#fff" stop-opacity="0"/>
  <stop offset="1" stop-color="#fff" stop-opacity="1"/>
</linearGradient>
<mask id="sombreado" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#caida)"/></mask>`;

export function prepararTintas(): void {
  if (document.getElementById("tintas")) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "tintas");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<defs>${DEFS}</defs>`;
  document.body.append(svg);
}

// Las páginas que usan paneles importan este módulo: los recursos tienen que estar antes de que el CSS los pida.
if (typeof document !== "undefined") prepararTintas();
