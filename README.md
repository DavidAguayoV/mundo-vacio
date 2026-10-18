# Mundo Vacío

Juego e historia sobre física para primer año: se parte en un espacio vacío y se van desbloqueando herramientas (sistema de referencia, partículas, vectores, gravedad, velocidad…).

## El mundo abierto

Después del primer rastro («El vacío») se revela el **mapa**: zonas alrededor del claro, cada una con su física, y en ellas **rastros** que dejó alguien que estuvo antes. Cada rastro es un desafío con objetivo; lo que trae (una herramienta o habilidad) se presta mientras se juega y se queda con el jugador al resolverlo, y se escribe una página en la **bitácora** (la idea, lo que midió el estudiante y una mirada de ingeniería). Hay estrellas por resolver, por predecir bien y por retos de maestría.

- **Puertas**: todo se ve desde el comienzo; la tarjeta dice qué falta para entrar y en qué rastro se gana. Entrar a un rastro y salir sin resolverlo no abre nada. En el mapa llevan nombre las zonas abiertas y sus vecinas; las demás son puntos atenuados.
- **La constelación** enseña vectores con una sonda que salta siguiendo tarjetas (cola con punta, el orden, −B, ejes ajenos).
- **La deriva** enseña inercia y velocidad sin gravedad: «Desde siempre» (la inercia y la apuesta a t = 4 s, hecha antes de ver el movimiento), «Cuadro a cuadro» (v = Δr/Δt paso a paso y los gráficos) y «La boya».
- **El pozo** tiene regiones con su propia gravedad: un rincón donde «abajo» es hacia el lado y la Luna junto a la Tierra, para comparar el mismo tiro.
- **Las laderas** separan la normal («El suelo empuja»), el roce estático («¿Se queda o desliza?») y la medición de μₛ con una pendiente cuyo roce no se muestra («La pendiente justa»).
- El lente **Gráficos** (se gana en «Cuadro a cuadro»; «Al blanco» pide leer vₓ en la cima) muestra x(t), y(t), vₓ(t) y v_y(t) de la partícula elegida, en tus ejes; la línea de tiempo es su cursor, al pasar el puntero se lee el valor y al tocar se va a ese instante.
- **El taller** (la ley del resorte, el ritmo y «Al mismo compás»: afinar un resorte al de otro), **el astro** (atracción, órbita y escape), **el mar** (la pluma y la piedra, velocidad terminal y «El paracaídas»: aterrizar a menos de 2,5 m/s) y **la central** (lo que no cambia, dónde está el cero, resorte y energía, y «Justo hasta arriba»: detenerla en la baliza). En la central también está el calor: «¿Adónde se fue?» (una caja que frena por roce: K pasa a Q), «El golpe» (un choque sin rebote) y «Justo en la marca» (elegir la rapidez para que se detenga en la baliza: d = v²/(2 μc g)).
- **El puente** trae los cuerpos rígidos: «La balanza» (poner pesas en una barra con eje hasta que quede derecha: torque), «La palanca» (correr el apoyo para que 1 kg levante 5 kg), «El péndulo que no es un punto» (una barra contra una pesa colgada del mismo largo) y «La carrera» (caja, disco y aro por pendientes iguales: a = g sen α / (1 + I/(m R²))). Con Partícula se ponen pesas tocando la barra; con Mover se corren las pesas y el apoyo.
- Cada zona tiene al menos un reto de maestría (una estrella extra): poner el origen sobre una partícula, una órbita casi circular, escapar con lo justo, aterrizar suave en el aire…
- **Cámara**: rueda o pellizco para acercar; arrastrar el espacio vacío con Mover (o con el botón del medio o el derecho) para recorrer; «Centrar la vista» o la tecla 0 para volver. Teclas + y − también acercan y alejan.

El avance se guarda solo en el navegador. Al abrir la página, sin avance se parte en «El vacío»; con avance, en el mapa (no a mitad de un rastro ni en el laboratorio). En la bitácora, **Guardar avance** lo descarga como `.json` y **Cargar avance** lo abre en otro navegador o equipo.

El avance guardado del relato lineal se migra solo: lo de los capítulos terminados queda resuelto.

## El juego simple (demo.html)

`demo.html` (publicada en https://davidaguayov.github.io/mundo-vacio/demo.html) es la versión simple del juego, para quien lo ve por primera vez: «Lanza y acierta». Ver `PROPUESTA_JUEGO_SIMPLE.md`.

- **Siete rastros en cuatro zonas** (el claro, la deriva, el pozo y el astro), en orden: «El vacío», «Una partícula», «Desde siempre», «La boya», «¿Dónde es abajo?», «Al blanco» y «En órbita». Solo el siguiente está abierto; «Siguiente: …» lleva de uno al otro y la tarjeta dice «Rastro 3 de 7».
- **Pocas herramientas:** Origen, Partícula, Mover, Velocidad y Gravedad, el tiempo (▶ y t = 0) y la Atracción en el final. Sin cámara lenta, gráficos ni línea de tiempo: en «Al blanco», el tiempo se detiene solo en la cima para comprobar la predicción.
- **Al terminar** se ganan todas las herramientas del juego (superficies, resortes, el medio, la energía, los gráficos…), aparecen el laboratorio y el árbol, y se puede volver a cualquier rastro por las estrellas que faltan.
- El avance se guarda aparte (claves `mundoVacio.demo.*`): no toca el del juego completo. «Empezar de nuevo» está siempre a la vista (dos toques).
- `demo.html?kiosco`, para un computador o tablet de feria: tras 90 s sin nadie pregunta «¿Sigues ahí?» y, si nadie toca en 30 s, vuelve al comienzo con el avance borrado. La entrada muestra un código QR para jugarla en el celular.
- La ruta está en `src/demo/route.ts` (como datos: cada parada es un rastro del juego completo, con sus ajustes) y sus reglas en `src/demo/policy.ts`. Para ampliarla se suman rastros y zonas a esa lista.

## Uso

```bash
npm install
npm run dev      # servidor local en http://localhost:5173
npm test         # tests del motor, del marco de referencia y del relato
npm run build    # build estático en dist/
```

Parámetros de URL útiles:

- `?debug`: muestra fps en el HUD y deja el juego en `window.mundo` para inspeccionarlo en la consola.
- `?stress=50`: prueba de rendimiento con 50 partículas en resortes (no toca el progreso guardado).

Atajos (cuando ya se ganó la habilidad): espacio = el tiempo fluye o se detiene, R = volver a t = 0, → = avanzar 0,1 s. Supr = eliminar la selección, Esc = deseleccionar.

## Laboratorio (modo libre)

Los **laboratorios con guía** se abren desde cualquier parte (botón Lab, o «Laboratorios» en el mapa): cada uno trae su objetivo, qué medir, preguntas, los lentes que necesita y deslizadores para el profesor (|g|, masa, v₀, ángulo, μₛ, k, masa y distancia de cada pesa, inclinación de las pistas). Mover un deslizador vuelve el lanzamiento a t = 0 con el valor nuevo.

Desde el árbol → «Modo libre», o al abrir un laboratorio. En modo libre el botón **Lab** abre el panel completo:

- **Guardar aquí**: guarda el experimento en este navegador (se reemplaza si ya existe uno con el mismo nombre).
- **Descargar .json** y **Abrir archivo .json** (o arrastrar el archivo al lienzo): para llevarlo a otro equipo.
- **Copiar enlace**: el experimento va comprimido dentro del enlace (`#exp=…`); quien lo abre lo ve en su modo libre sin perder su avance en el relato.
- **Ejemplos**: caída de dos masas, tiro parabólico al blanco, el mismo tiro en la Luna, planos con roce, medir μₛ, masa colgada de un resorte, órbita circular, caída con aire, suma en ejes girados, frenado por roce, el balancín y la carrera de cuerpos que ruedan.
- **Mundo**: |g| de la Tierra, la Luna o Marte, o sin gravedad; atracción entre masas; medio (vacío, aire o agua); vaciar el mundo.
- **Vista**: cámara lenta (×½, ×¼) y ocultar los vectores r o la trayectoria cuando hay muchas partículas.

Siempre se guarda el mundo como estaba al lanzar, no a mitad de vuelo. El relato y el laboratorio tienen cada uno su mundo, que se autoguarda en el navegador.

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy.yml` corre los tests, construye y publica `dist/` al hacer push a `main`. En el repositorio: Settings → Pages → Source: GitHub Actions. El build usa rutas relativas, así que funciona en `https://<usuario>.github.io/<repo>/`.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `src/physics` | RK4 de sistema con paso fijo (1/240 s), fuerzas (`Force`), simulación con acumulador y estroboscopio |
| `src/physics/energy.ts` | energía del sistema (K, Ug, Ue, UG) y el calor Q, que la simulación mide aparte: potencia del roce y del arrastre en cada etapa de RK4, más lo que se pierde en choques y al detenerse |
| `src/physics/rigid.ts` | cuerpos rígidos 2D (barra, disco, aro, caja): giro en torno a un eje con RK4 y tope, rodar sin deslizar por una superficie, momento de inercia, torque y energía |
| `src/physics/constraints` | superficies rígidas: choque plástico, contacto, separación; la normal y el roce (`forces/normal.ts`, `forces/friction.ts`) leen esos contactos |
| `src/world` | entidades serializables, sistema de referencia del usuario (`toUser` / `toGlobal`) |
| `src/render` | cámara, paleta desde los tokens CSS, capas del lienzo |
| `src/tools` | herramientas como plugins (`Tool`), una por archivo |
| `src/story` | rastros y zonas como datos (`sites.ts`), el motor del mundo abierto (`siteEngine.ts`), los capítulos de antes que siguen como rastros (`chapters.ts`) y `RunMonitor`, que traduce cada lanzamiento en eventos (cayó, se apoyó, la sostiene el roce, desliza) |
| `src/map` | el mapa: zonas, caminos, marcadores accesibles y su cámara |
| `src/lab` | experimentos (formato, enlaces, biblioteca local, ejemplos) y el panel del laboratorio |
| `src/tree` | árbol de habilidades |
| `src/ui` | tarjeta de relato, caja de herramientas, inspector, HUD, bitácora |
| `src/demo` | el juego simple (`demo.html`): ruta, puertas, pantalla de entrada, final, kiosco y el código QR; se engancha al juego por `src/mode.ts` |

Agregar un rastro: un objeto `Site` más en `src/story/sites.ts` (zona, posición en el mapa, nota, lo que pide, cómo se arma, sus pasos y su página). Agregar una herramienta: un archivo en `src/tools/` y una línea en `registry.ts`. Agregar una fuerza: una clase que implemente `Force` en `src/physics/forces/`.

El prototipo original de un archivo está en `mundo-vacio.html`.
