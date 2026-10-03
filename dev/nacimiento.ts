// Página de desarrollo: no entra en el build. Al terminar muestra los datos que recibiría el motor.
import "@fontsource-variable/archivo/wdth.css";
import "../src/estilos.css";
import "../src/ui/tintas";
import { abrirNacimiento } from "../src/ui/nacimiento";

const panel = document.getElementById("panel")!;
abrirNacimiento(panel, (datos) => {
  const salida = document.createElement("pre");
  salida.id = "salida";
  salida.textContent = JSON.stringify(datos, null, 2);
  panel.replaceChildren(salida);
});
