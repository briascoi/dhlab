# Base de conocimiento de Diseño Humano

Lo que DH Lab sabe del sistema, con la fuente de cada afirmación. Sirve para que el motor, la interfaz y, más adelante, las fichas y el coach no afirmen nada sin respaldo.

Leído y escrito el 2026-10-03.

## Reglas de este documento

1. **Solo entra lo que dice una fuente leída.** Cada afirmación lleva su marca de fuente entre corchetes. Si no hay fuente, va a la sección "Lo que no sabemos" y no se usa en el producto.
2. **Regla mecánica y significado son cosas distintas.** Una regla mecánica dice cómo se calcula algo (qué Centro está definido, qué Canal une qué). El significado dice qué quiere decir eso para una persona. Este documento cubre las reglas mecánicas y los nombres. Los significados son contenido de fichas: los escribe y aprueba Isma (B3 del plan).
3. **No se copian textos de las fuentes.** Jovian Archive tiene derechos reservados: se toman hechos y citas breves entre comillas. El código con licencia MIT se puede usar con su atribución.
4. **Una regla que el motor calcula necesita dos fuentes que coincidan**, o una fuente y la confirmación de Isma.
5. **Las traducciones al español son propias y las aprueba Isma** en el registro de textos. No encontré una fuente oficial en español.

## Fuentes

| Marca | Fuente | Qué es | Cómo se puede usar | Para qué la usamos |
|---|---|---|---|---|
| J1 | Jovian Archive, "Type and Strategy in Human Design", jovianarchive.com/pages/type-and-strategy-in-human-design | Página oficial de la organización fundada por Ra Uru Hu | Hechos y citas breves | Tipos, Estrategia, Firma, No-Yo |
| J2 | Jovian Archive, "Human Design Dictionary", jovianarchive.com/pages/human-design-dictionary | Diccionario oficial | Hechos y citas breves | Definiciones de términos |
| J3 | Jovian Archive, "What Is Inner Authority in Human Design", jovianarchive.com/pages/what-is-inner-authority-in-human-design | Página oficial | Hechos y citas breves | Orden y nombres de las Autoridades |
| J4 | Jovian Archive, páginas de cada Autoridad: Ego Manifested, Ego-Projected, Self-Projected y Mental (direcciones al final) | Páginas oficiales | Hechos y citas breves | Condición mecánica de cada Autoridad |
| S1 | SharpAstrology.HumanDesign, github.com/CReizner/SharpAstrology.HumanDesign, commit 5d95ece (2026-07-29) | Biblioteca de código abierto, licencia MIT | Se puede usar y adaptar con atribución | Segunda fuente de la tabla del sistema y de las reglas de Tipo y Autoridad; constantes de la rueda |
| H1 | humandesignsystem.co, "36 Channels of the Human Design Chart" | Sitio de divulgación | Hechos | Primera fuente de la tabla de Canales (ya citada en `src/engine/system-data.ts`) |
| M1 | micartadisenohumano.com, diccionario de Autoridad | Sitio en español, sin afiliación declarada | Solo referencia de vocabulario | Cómo nombra las Autoridades un sitio en español |
| O1 | Unforced-Dev/open-human-design (GitHub) | App de código visible, **sin licencia** | No se puede copiar nada; solo mirar la experiencia de uso | Ninguno en el código |

Todas leídas el 2026-10-03. De J1 a J4 la lectura fue por extracción automática de la página; las citas son breves y conviene que Isma las confirme a ojo antes de usarlas en una ficha.

**Verificación del 2026-10-04.** La extracción automática puede inventar cifras y citas (pasó con porcentajes de Definición, que se descartaron). Por eso, todas las citas y cifras que usan las fichas de los Capítulos 1 y 2 se cotejaron contra el texto crudo de J1 y de las ocho páginas de Autoridad, bajado sin resumir: aparecen todas tal cual, salvo una que estaba con la puntuación cambiada y se corrigió. Regla desde ahora: ninguna cita entra a una ficha sin aparecer literalmente en el texto crudo de la página.

## Tipos

**Hay cuatro Tipos, y el Generador Manifestante es un subgrupo del Generador.** El diccionario oficial lo dice así: "The manifesting Generator is neither a Manifestor nor a separate Type, it is a sub group of Generator" [J2]. DH Lab lo muestra como quinto nombre porque así lo conoce la gente, pero comparte Estrategia, Firma y No-Yo con el Generador [J1].

**Motores.** Son cuatro: Sacral, Corazón, Plexo Solar y Raíz [J2].

**Regla mecánica** (coinciden J2 y S1; es la que usa `tipoDe` en `src/engine/carta.ts`):

| Tipo | Condición |
|---|---|
| Reflector | Ningún Centro definido [S1] |
| Generador | Sacral definido, y la Garganta no está unida a un motor [J2] |
| Generador Manifestante | Sacral definido, y la Garganta está unida a un motor [J2] |
| Manifestador | Sacral sin definir, y un motor unido a la Garganta [S1] |
| Proyector | Sacral sin definir, y ningún motor unido a la Garganta [S1] |

"Unida" quiere decir en el mismo grupo de Centros conectados por Canales definidos, no necesariamente por un Canal directo [S1].

**Estrategia, Firma y No-Yo** [J1]:

| Tipo | Estrategia | Firma | No-Yo |
|---|---|---|---|
| Generador y Generador Manifestante | "Wait to respond" | "Satisfaction" | "Frustration" |
| Proyector | "Wait for the invitation" | "Success" | "Bitterness" |
| Manifestador | "To inform before they act" | "Peace" | "Anger" |
| Reflector | "Wait a full lunar cycle" (unos 28 días) | "Surprise" | "Disappointment" |

El diccionario confirma los cuatro temas de No-Yo [J2].

**Proporción de la población**, según J1: Generadores "about 70%", Proyectores "just over 20%", Manifestadores "about 9%", Reflectores "just over 1%". Son cifras de la fuente, no medidas por nosotros: si se muestran, van con su atribución.

## Responder e iniciar

Es lo que necesitan los interruptores del mapa.

| Tipo | Qué dice la fuente | Responder | Iniciar |
|---|---|---|---|
| Generador y Generador Manifestante | Su Estrategia es responder; "not here to initiate" [J1] | Sí, con fuente | No, con fuente |
| Manifestador | "Here to initiate, to get things started" [J1] | Sin fuente | Sí, con fuente |
| Proyector | "Wait for the invitation"; "not here to do" y "they are here to guide" (la fuente las une con una raya) [J1] | Sin fuente | Sin fuente |
| Reflector | Espera un ciclo lunar [J1] | Sin fuente | Sin fuente |

**Conclusión.** Isma confirmó la tabla el 2026-10-03: Generador y Generador Manifestante, responder sí e iniciar no; Manifestador, responder no e iniciar sí; Proyector y Reflector, los dos en no. Es su decisión de contenido. Lo que la fuente respalda de esa tabla son las celdas marcadas "con fuente"; las demás son la lectura de Isma y no una cita.

Para un Proyector o un Reflector, la fuente no dice ni "responder" ni "iniciar": su Estrategia es otra. Si más adelante se quiere que los interruptores les digan algo propio, las opciones son mostrarlos solo a Generadores y Manifestadores, o cambiar el rótulo según el Tipo (por ejemplo, "Esperar la invitación: Sí").

## Autoridad

**Definición.** La Autoridad interna es aquello en lo que una persona puede confiar para decidir, "and it is never the mind" [J2].

**Nombres.** Jovian Archive lista ocho [J3]: Emotional (Solar Plexus), Sacral, Splenic, Ego Manifested, Ego-Projected, Self-Projected, Mental o Sounding Board, y Lunar. S1 usa los mismos ocho.

**Orden.** La Autoridad sale del primer Centro definido en este orden [J3, S1]:

| Orden | Autoridad | Condición mecánica | Tipos | Fuente |
|---|---|---|---|---|
| 1 | Emocional | Plexo Solar definido | Cualquiera con ese Centro | J3, S1 |
| 2 | Sacral | Sacral definido, Plexo Solar sin definir | Generadores | J3, S1 |
| 3 | Esplénica | Bazo definido; Plexo Solar y Sacral sin definir | Manifestadores y Proyectores | J3, S1 |
| 4 | Ego manifestado | Corazón unido a la Garganta, por el Canal 21-45 o por el 25-51 pasando por el G; Plexo Solar, Sacral y Bazo sin definir | Manifestadores | J4, S1 |
| 4 | Ego proyectado | Corazón unido al G por el Canal 25-51; los tres de arriba sin definir | Proyectores | J4, S1 |
| 5 | Autoproyectada | G unido a la Garganta; Plexo Solar, Sacral y Bazo sin definir | Proyectores | J4, S1 |
| 6 | Mental | Definición solo de la Garganta para arriba (Cabeza, Ajna, Garganta) | Proyectores | J4, S1 |
| 6 | Lunar | Ningún Centro definido | Reflectores | J3, S1 |

Las dos fuentes dan la misma regla. Está implementada en `autoridadDe` (`src/engine/carta.ts`) con un test por caso.

**Dos detalles que salen de la tabla de Canales y no de una cita:**
- Con el Corazón definido y sin Plexo Solar, Sacral ni Bazo, solo quedan dos casos posibles: Corazón a la Garganta (Manifestador) o Corazón al G (Proyector). Por eso alcanza con mirar el Tipo, como hace S1.
- Si el G está definido y no lo están Plexo Solar, Sacral, Bazo ni Corazón, el G solo puede estar unido a la Garganta, porque sus otros Canales van a esos Centros.

**Siete u ocho.** Algunos sitios juntan las dos del Ego y cuentan siete. M1 lista siete: Emocional, Sacral, del Bazo (Esplénica), del Ego, del Ser, Mental y Lunar. DH Lab usa las ocho de la fuente oficial. Isma fijó esta taxonomía el 2026-10-03.

**Proporciones** [J3]: Emocional, "about 50% of the population"; las dos del Ego juntas, "about 4% of people".

**Efecto en el producto.** Si dentro del rango de una hora incierta cambia la Autoridad, la carta queda "pendiente de hora", igual que cuando cambia el Tipo (plan, "Datos de nacimiento inciertos").

**Cómo decide cada Autoridad, según su página oficial** [J4]. Leídas las ocho el 2026-10-04, por extracción automática: las citas son breves y conviene confirmarlas a ojo.

| Autoridad | Cómo decide | Qué señala como error |
|---|---|---|
| Emocional | "There is no truth in the now"; la ola emocional sube y baja y hay que esperar a que complete su ciclo | Decidir en un pico o en un bajón; dejar que decida la urgencia |
| Sacral | Respuesta visceral ("gut-level reaction"), con sonidos como "uh-huh" y "unh-unh"; "The Sacral responds, it does not initiate" | Pasar por encima de la respuesta; preguntas abiertas en lugar de sí o no; consultarlo con la almohada |
| Esplénica | Registra lo sano y seguro en el instante; "The Spleen speaks once" | Esperar una segunda señal; consultarlo con la almohada; dejar que la mente lo elabore |
| Ego manifestado | "You need to hear yourself speak": vale lo que se dice de forma espontánea | Decidir en silencio |
| Ego proyectado | Esperar reconocimiento e invitación clara, y preguntarse si sirve a las propias necesidades e intereses | Iniciar sin invitación; dejar que decida la mente; decir que sí para servir primero a otros; saltearse el descanso |
| Autoproyectada | "Your truth is expressed through what you say": hablar con alguien de confianza y escuchar la propia voz | Decidir en silencio; un oyente que aconseja; confiar en el argumento mental; tomar por propia la emoción de otros |
| Mental | Oírse hablar de la decisión con alguien de confianza | Decidir a solas en la cabeza; oyentes con intereses propios o que quieren arreglarlo |
| Lunar | Cada decisión importante necesita unos 29,5 días; hablarla con personas de confianza para oírse | Decidir antes de terminar el ciclo; tomar las conversaciones como búsqueda de consejo |

Otras cifras de esas páginas: cerca del 51% de las personas tiene el Plexo Solar definido; Generadores y Generadores Manifestantes, "around 70%"; Reflectores, "around 1.3 or 1.4%". Las páginas de Esplénica, Ego proyectado y Mental no dan cifra.

## Definición

Cinco estados [J2, S1]: sin definición, simple ("a continuous connection"), partida ("two areas of definition separate from each other"), triple partida ("three separated areas") y cuádruple partida ("four separate unconnected definitions"). Se cuentan los grupos de Centros unidos por Canales definidos.

## Perfil

Sale de la Línea del Sol de la Personalidad y la del Sol del Diseño: "twelve Profiles derived from the Line positions of the Personality Sun/Earth and the Design Sun/Earth" [J2].

Los doce son 1/3, 1/4, 2/4, 2/5, 3/5, 3/6, 4/6, 4/1, 5/1, 5/2, 6/2 y 6/3 [S1].

## Centros, Puertas y Canales

- **Nueve Centros, 64 Puertas y 36 Canales.** La tabla está en `src/engine/system-data.ts`, tomada de H1.
- **Segunda fuente.** La tabla coincide entera con S1: los 36 Canales con sus dos Puertas, y el Centro de cada una de las 64 Puertas. Hay un test que lo comprueba contra una copia de la tabla de S1 (`test/fixtures/sharpastrology-tabla.json`).
- **Un Canal está definido** si sus dos Puertas están activas; **un Centro**, si tiene al menos un Canal definido. Es la regla que usa `src/engine/definicion.ts`; no la releí en una fuente en esta pasada.

## Cálculo de la carta

- **Dos momentos.** Personalidad: el nacimiento. Diseño: cuando el Sol estaba 88° de longitud antes. Ya está implementado en `diaDeDiseno`, con la fuente que cita el plan; no lo releí en esta pasada.
- **Rueda.** El orden de las Puertas y dónde empieza cada una salen de S1 (`src/engine/rueda.ts`).
- **Trece cuerpos** por momento, 26 activaciones en total (`src/engine/efemerides.ts`).

**Validación externa del cálculo** (detalle en el plan, "Validación del motor"):
- Cuatro cartas reales del círculo de Isma: el motor reproduce las 26 activaciones y los cuatro datos derivados. No se probó la conversión de hora, porque faltan los datos de nacimiento.
- 26 personas públicas con datos de Astro-Databank: 25 coinciden de punta a punta con otro motor independiente. La que difería tiene el nodo del Diseño a 0,06° del borde de una Puerta, y la calculadora oficial de Jovian Archive le da la razón a nuestro motor: las 26 activaciones y los cuatro datos derivados son iguales.
- **Nodo:** DH Lab usa el nodo verdadero. Las cuatro cartas del círculo solo coinciden completas con el nodo verdadero, y la calculadora oficial de Jovian Archive también lo usa (en el caso borde, el nodo medio daría otra Línea).

## Vocabulario en español

No encontré una fuente oficial en español. Los nombres que usa DH Lab son traducciones propias y están o estarán en el registro de textos:

| Inglés (fuente) | DH Lab | Estado |
|---|---|---|
| Generator, Manifesting Generator, Projector, Manifestor, Reflector | Generador, Generador Manifestante, Proyector, Manifestador, Reflector | Aprobado; coincide con M1 |
| Emotional, Sacral, Splenic | Emocional, Sacral, Esplénica | Aprobado |
| Ego Manifested, Ego-Projected | Ego manifestado, Ego proyectado | Aprobado |
| Self-Projected | Autoproyectada | Aprobado; M1 dice "del Ser" |
| Mental (Sounding Board) | Mental | Aprobado |
| Lunar | Lunar | Aprobado |

## Lo que no sabemos

Nada de esto se puede afirmar en el producto hasta tener fuente:

- **El significado de cada pieza**: qué quiere decir tener un Centro definido o indefinido, cada Canal, cada Puerta, cada Línea de Perfil. Es contenido de fichas (B3).
- **Qué le toca a un Proyector o a un Reflector** en términos de "responder" e "iniciar".
- **Si un Generador Manifestante "inicia" después de responder.** La fuente lo cuenta como Generador y no leí más detalle.
- **Vocabulario oficial en español.**
- **Centros de conciencia, de presión y demás clasificaciones** de los Centros fuera de los cuatro motores: no las leí.
- **Cruz de Encarnación, Variables, Color, Tono y Base**: S1 las calcula, pero quedan fuera de la primera versión (plan).
- **Tránsitos y cartas de conexión**: postergados (TODOS.md).

## Direcciones de las páginas de Autoridad

- jovianarchive.com/pages/emotional-authority-in-human-design-waiting-through-the-wave
- jovianarchive.com/pages/sacral-authority-in-human-design-trusting-the-gut-response
- jovianarchive.com/pages/splenic-authority-in-human-design-the-bodys-quiet-instant-knowing
- jovianarchive.com/pages/ego-manifested-authority-in-human-design-the-will-that-speaks
- jovianarchive.com/pages/ego-projected-authority-in-human-design-willpower-and-invitations
- jovianarchive.com/pages/self-projected-authority-in-human-design-the-projectors-voice
- jovianarchive.com/pages/mental-authority-in-human-design-a-projector-process
- jovianarchive.com/pages/lunar-authority-in-human-design-why-reflectors-need-29-5-days

Las ocho están leídas (cuatro el 2026-10-03 y las de Emocional, Sacral, Esplénica y Lunar el 2026-10-04), además de la página general.
