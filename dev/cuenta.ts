// Página de desarrollo: no entra en el build. El servidor es simulado (ver `simulada.ts`).
// ?entrar muestra la variante "Ya tengo cuenta".
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/martian-mono/wdth.css";
import "../src/estilos.css";
import "../src/ui/tintas";
import { abrirCuenta } from "../src/ui/cuenta";
import { dibujarMapa } from "../src/ui/mapa";
import { simulada } from "./simulada";

const panel = document.createElement("main");
panel.className = "panel panel-mapa";
panel.append(dibujarMapa([64, 47, 34, 57, 1, 6, 41, 3, 60]));
document.body.append(panel);
const variante = new URLSearchParams(location.search).has("entrar") ? "entrar" : "guardar";
const hoja = abrirCuenta({ api: simulada, variante, alTerminar: (cuenta) => { hoja.close(); panel.dataset.cuenta = cuenta.email; } });
