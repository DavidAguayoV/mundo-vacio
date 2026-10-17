# Mundo Vacío — Un mundo para explorar

Propuesta para revisar antes de programar. Lo que entendí del encargo: que el juego sea atractivo; que el estudiante explore por su cuenta en un mundo abierto; que existan laboratorios para mostrar cosas en clase; que quede abierta la puerta a cuerpos rígidos y a 3D, y que se cambie lo que haga falta (por ejemplo, la parte de vectores, que resulta fome).

## 1. Qué no funciona hoy

1. **Es un tutorial con buena voz, no un juego.** Los 11 capítulos van en fila y cada tarjeta dice qué tocar. El estudiante nunca decide qué hacer ni a dónde ir.
2. **No hay nada que resolver.** Salvo «Al blanco», ningún capítulo tiene un objetivo que se pueda lograr bien o mal. Las predicciones se responden y se sigue igual.
3. **El mundo cabe en una pantalla.** La vista es fija: no hay un «allá» que explorar, aunque el juego se llame *Mundo* Vacío.
4. **Los vectores no sirven para nada.** Se dibuja una flecha, se suman dos y se giran los ejes. Es correcto, pero el vector no resuelve ningún problema.
5. **El modo libre está desconectado.** Al final se abre un laboratorio vacío, sin preguntas ni retos que usen lo aprendido.

## 2. La idea: rastros en el vacío

> «El vacío no está del todo vacío. Alguien estuvo aquí antes y dejó **rastros**: una partícula que se mueve sola desde siempre, un blanco que nadie alcanzó, algo que gira alrededor de nada. Cada rastro es una pregunta.»

El estudiante llega a un mundo grande y oscuro. Lo único que ilumina es su sistema de referencia: donde pone el origen se enciende la luz que ya diseñamos. En la penumbra brillan, apenas, los rastros. Se acerca, entiende qué pasa, lo resuelve y gana una herramienta nueva, que a su vez abre rastros que antes no podía tocar.

Son cuatro piezas:

| Pieza | Qué es | Reemplaza a |
| --- | --- | --- |
| **El mapa** | un mundo de unas 10 pantallas, con paneo y zoom, dividido en zonas con su propia física | la vista fija |
| **Los rastros** | unos 20 desafíos breves repartidos por el mapa, cada uno con un objetivo verificable | los capítulos en fila |
| **La bitácora** | un cuaderno que se llena al resolver cada rastro: la ley en una línea, **los números que midió el estudiante** y la mirada de ingeniería | las tarjetas de cierre |
| **Los laboratorios** | demostraciones armadas para clase, con guía y gráficos, abiertas desde el comienzo | los «ejemplos» del panel Lab |

### Cómo se juega un rastro

1. **Se descubre:** en el mapa se ve una señal tenue y, al acercarse, el rastro muestra su situación (sin texto largo, una pregunta).
2. **Se intenta:** el estudiante usa las herramientas que tiene. Si le falta una, el rastro lo dice («necesitas poder darle velocidad a algo») y queda marcado en el mapa.
3. **Se predice, si quiere:** antes de dejar fluir el tiempo puede apostar qué pasará. Acertar da una estrella.
4. **Se resuelve:** el objetivo se cumple (llegar a la baliza, acertar al blanco, dejarla en órbita). La bitácora escribe la página con sus números.
5. **Maestría opcional:** cada rastro tiene uno o dos retos extra para quien quiera más («acierta al primer intento», «hazlo con los ejes girados»). Esas estrellas son las que dan ganas de volver.

**Libertad con puertas suaves:** desde el principio se puede ir a cualquier parte, pero cada zona necesita ciertas herramientas para resolverse. Siempre hay dos o tres rastros disponibles, nunca uno solo: el estudiante elige el orden.

## 3. Vectores, rehechos: la sonda

En el Acto I todavía no existe el tiempo, así que nada se mueve solo. Lo que se mueve es una **sonda** que solo sabe saltar: se le da una cadena de vectores desplazamiento y ella los recorre, cola con punta. Los vectores dejan de ser dibujos y pasan a ser **instrucciones**.

| Rastro | Situación | Se descubre |
| --- | --- | --- |
| **Dos saltos** | La sonda tiene dos tarjetas, A y B, y una baliza lejos. ¿Llega? ¿Importa el orden? | suma, cola con punta, A + B = B + A |
| **El atajo** | Hay un muro en el camino directo. Hay que llegar con A, B y C sin tocarlo. | la suma no depende del camino |
| **Solo A, pero cuantas veces quieras** | Las tarjetas son A y −B; la baliza está en 2A − B. | multiplicar por un escalar, el vector opuesto |
| **Los ejes de la otra persona** | La bitácora dice: «dejé la baliza en (4 ; 1), medido en mis ejes», y sus ejes están girados 30°. | las componentes dependen de los ejes, la flecha no |
| **Contra la corriente** *(llega después, con Velocidad)* | Una zona con corriente que arrastra todo; el muelle está enfrente. | velocidad relativa: v respecto al suelo = v propia + v de la corriente |

Así, girar los ejes deja de ser «gira y mira el panel»: es la única forma de encontrar una baliza.

## 4. El mapa

```
                    ·  El astro (gravitación)
       El mar ·                                   · El taller (resortes)
     (arrastre)            ┌──────────┐
                           │ El claro │  ← se empieza aquí
   Las laderas ·           └──────────┘          · La constelación (vectores)
   (superficies, roce)
                  · El pozo (g)          · La deriva (sin gravedad)
                         · La central (energía)
```

| Zona | Física local | Rastros (ejemplos) | Se gana |
| --- | --- | --- | --- |
| **El claro** | nada | fijar el origen; «dos personas miden la misma piedra» (r depende del origen) | Origen, Partícula, Mover |
| **La constelación** | nada | los rastros de la sonda (sección 3) | Vector, Sumar |
| **La deriva** | sin g | «algo se mueve desde siempre» (inercia); «atrapa la boya» (calcular cuándo pasa, v = Δr/Δt); contra la corriente | Tiempo, Velocidad, paso a paso |
| **El pozo** | g hacia abajo; un rincón con g de lado y otro con la g de la Luna | «¿dónde es abajo?»; dos masas; al blanco; el mismo tiro en la Luna | Gravedad, cámara lenta, línea de tiempo, **Gráficos** |
| **Las laderas** | g y planos | «¿se queda o desliza?»; medir μₛ con la pendiente justa | Superficie, normal, roce |
| **El taller** | g | «algo oscila sin que nadie lo toque» (un resorte que no se ve); medir el período | Resorte |
| **El astro** | una gran masa oscura | «gira alrededor de nada»; ponla en órbita; escápate | Gravitación |
| **El mar** | aire y agua por zonas | velocidad terminal; el paracaídas | Medio |
| **La central** | todas | «¿adónde se fue la energía?» | Energía (y luego el Calor, la fase E2 pendiente) |

Lo que ya existe en los capítulos 1 al 11 no se pierde: casi todo se convierte en rastros, con los mismos textos de ingeniería y las mismas predicciones, ahora con objetivo.

## 5. Los laboratorios (para mostrar en clase)

Cada laboratorio es una situación lista para proyectar, abierta desde el inicio y sin depender del avance del estudiante. Además del mundo armado, trae:

- **Una guía corta:** objetivo, qué medir y dos o tres preguntas.
- **Gráficos sincronizados con la línea de tiempo:** x(t), y(t), vₓ(t) y v_y(t) de la partícula elegida. Al arrastrar la línea de tiempo, el punto avanza en el gráfico. Es lo que más falta para cinemática de FIS101.
- **Controles del profesor:** cambiar |g|, la masa o v₀ con un deslizador y relanzar.

Laboratorios iniciales: caída de dos masas, tiro parabólico (y en la Luna), plano inclinado con roce, masa en un resorte, órbita circular, caída con aire y suma de vectores en ejes girados. Son los nueve ejemplos de hoy, cada uno con su guía y sus gráficos.

## 6. Lo que cambia en el motor

| Cambio | Para qué | Tamaño |
| --- | --- | --- |
| Cámara con paneo y zoom (arrastrar con dos dedos, rueda, botón «volver al origen») | el mapa | medio (`View` ya tiene `center` y `S`) |
| **Regiones**: g y medio por zona (`g(pos)`, `medio(pos)`) | zonas con su propia física | medio: cambia `UniformGravity` y el arrastre |
| Rastros como datos (`Site`: zona, posición, qué necesita, cómo se arma, cuándo se resuelve, qué entrega, página de bitácora) y su motor | reemplaza a `Chapter` y `StoryEngine` | grande, pero reutiliza los eventos y el `RunMonitor` de hoy |
| Sonda y balizas | vectores como instrucciones | pequeño |
| Bitácora (guardada en el navegador) | progreso legible | pequeño |
| Lente **Gráficos** | laboratorios y rastros de cinemática | medio |
| Laboratorios con guía | clase | pequeño (los ejemplos ya existen) |
| Migración del avance guardado | quien ya jugó no pierde nada | pequeño: los capítulos alcanzados marcan sus rastros como resueltos |

Lo que **no** cambia: el integrador RK4, las fuerzas, el contacto, los resortes, la línea de tiempo, el formato de los experimentos y el diseño visual que acabamos de publicar.

### La puerta a cuerpos rígidos y a 3D

- **Cuerpos rígidos en 2D: el paso natural.** Hoy cada cuerpo tiene 2 grados de libertad (x, y). Un cuerpo rígido plano tiene 3 (x, y, θ), con velocidad angular y momento de inercia, y las fuerzas pasan a tener un punto de aplicación, o sea, torque. Propongo preparar el estado del sistema para que cada cuerpo declare sus grados de libertad. Así una zona nueva, **El puente**, con palancas, una balanza, una rueda que rueda y equilibrio de torques, se agrega sin reescribir el motor. Calza con lo que viene en FIS101.
- **3D: un modo aparte, más adelante.** La física pasaría a Vec3 sin mucha dificultad. Lo caro es el resto: dibujar en perspectiva y, sobre todo, que el estudiante coloque y arrastre cosas en 3D con un mouse o un dedo. Recomiendo no mezclarlo con el mundo 2D. Sería un epílogo propio («la tercera dimensión», que ya está en el árbol), cuando el 2D esté maduro. Para no cerrar la puerta, bastaría con que las fuerzas nuevas usen las operaciones de `vec.ts` y no accedan a `.x` y `.y` sueltos.

## 7. Fases

- **F1. El mundo y la sonda:**
  - Cámara con paneo y zoom.
  - El mapa con sus zonas, el motor de rastros y la bitácora.
  - Tres zonas jugables: el claro, la constelación (vectores nuevos) y la deriva.
  - La migración del avance guardado.
- **F2. Gravedad por zonas y laboratorios:**
  - Regiones de g, con el pozo y sus rincones.
  - Las laderas.
  - El lente Gráficos.
  - Los laboratorios con guía.
- **F3. El resto del mapa:** el taller, el astro, el mar y la central, más los retos de maestría en todas las zonas.
- **F4. Cuerpos rígidos en 2D:** la zona El puente.
- **3D:** se evalúa después de F4.

Cada fase cierra como siempre: tests, build, capturas, un PR para que lo revises y se publica cuando hagas el merge.

## 8. Decisiones que necesito de ti

1. **¿Un hilo narrativo con una persona que estuvo antes** (sus rastros y su bitácora, sin nombre), o el vacío solo, sin personaje? Recomiendo la persona: le da al estudiante una razón para buscar.
2. **¿Puertas suaves** (todo visible desde el inicio, cada zona pide sus herramientas) o un mundo que se abre por zonas? Recomiendo las puertas suaves.
3. **¿Estrellas y retos de maestría?** Le dan rejugabilidad, pero también pueden distraer si lo usas en clase.
4. **¿Te sirve la sonda para vectores?** ¿O prefieres que los vectores lleguen ya con velocidad (corrientes, viento cruzado)?
5. **¿Gráficos x(t) y v(t) en F2,** o los necesitas antes para clase?
6. **¿Cuerpos rígidos en 2D antes que 3D?**
