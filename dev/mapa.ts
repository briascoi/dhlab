// Página de desarrollo: no entra en el build. Las Puertas son un ejemplo, no una carta real,
// y el rótulo del panel es de muestra (sin aprobar). ?cap=4 simula el Capítulo 4 abierto.
import "@fontsource-variable/archivo/wdth.css";
import "../src/estilos.css";
import "../src/ui/tintas";
import { dibujarDetalle } from "../src/ui/detalle-centro";
import { dibujarMapa } from "../src/ui/mapa";

const puertas = [64, 47, 34, 57, 1, 6, 41, 3, 60];
const capitulos = Number(new URLSearchParams(location.search).get("cap") ?? 1);

const panel = document.createElement("main");
panel.className = "panel panel-mapa";
const rotulo = document.createElement("p");
rotulo.className = "rotulo";
rotulo.textContent = "Tu diseño";
let detalle: HTMLElement | undefined;
const mapa = dibujarMapa(puertas, (id) => {
  const nuevo = dibujarDetalle(id, capitulos, puertas);
  detalle?.remove();
  detalle = nuevo;
  panel.append(nuevo);
});
panel.append(rotulo, mapa);
document.body.append(panel);
