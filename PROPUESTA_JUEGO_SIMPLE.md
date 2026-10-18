# Mundo Vacío — El juego simple

Propuesta para revisar antes de programar (17-10-2026). El encargo: una versión más simple, con las mejores herramientas y una historia más corta, que funcione como juego por sí sola y que después se pueda ampliar. Hoy el juego tiene mucho que nadie alcanza a ver.

## 1. Por qué no se alcanza a ver

Datos medidos sobre `main`:

| | Hoy |
| --- | --- |
| Zonas | 10 |
| Rastros | 36 (126 pasos) |
| Controles que se ganan | 18: 9 herramientas, 5 del tiempo, 2 fuerzas y 2 lentes |
| Botones en la barra con todo ganado | 22 |
| Sistemas aparte | mapa, bitácora, árbol, laboratorios, modo libre, estrellas, retos, predicciones |

Cuánto se usa cada control en los 36 rastros:

| Control | Rastros que lo **piden** para entrar | Rastros donde la tarjeta **lo hace usar** |
| --- | --- | --- |
| Gravedad | 10 | 1 |
| Tiempo (▶) | 8 | 1 |
| Velocidad | 7 | 8 |
| Mover | 2 | 8 |
| Partícula | 5 | 3 |
| t = 0 | 0 | 3 |
| Origen | 1 | 1 |
| Energía (lente) | 6 | 3 |
| Sumar | 3 | **0** |
| Vector | 0 | 1 |
| Paso a paso, línea de tiempo, Atracción, Superficie | 1 a 3 | 1 cada uno |

Lo que se lee en la tabla:

- **Cinco controles cargan el juego:** Partícula, Velocidad, Gravedad, el tiempo (▶ y t = 0) y Mover. Casi todo lo demás aparece en uno o dos rastros y después no vuelve.
- **El ciclo que hace de esto un juego ya existe, pero aparece tarde:** preparar → predecir → dejar fluir → ¿acerté? → t = 0 → ajustar. Recién se completa en el rastro 6 o 7 (la boya, «Al blanco», la órbita).
- **Cada zona trae su propio sistema** (la sonda, los planos, los resortes, el medio, la energía, los cuerpos rígidos). Cada uno está bien hecho, pero juntos son diez juegos chicos en vez de uno.

## 2. Las mejores herramientas

Criterio: la herramienta (a) se usa muchas veces, (b) hace que algo se mueva en pantalla, (c) permite intentar, fallar y volver a intentar, y (d) enseña una idea central de Física 1.

| Queda en el juego simple | Por qué |
| --- | --- |
| **Origen** | La idea fundadora: los ejes son una elección. Solo se usa al comienzo, pero sin ella la historia no parte. |
| **Partícula** | El objeto del juego. |
| **Velocidad** | El control de juego por excelencia: apuntar. Es la más usada. |
| **Gravedad** | La que más piden los rastros, y la que hace que las cosas caigan. |
| **Mover** | Corregir sin borrar (y mover el origen). |
| **▶ / ‖ y t = 0** | El tiempo y el «otra vez». Sin t = 0 no hay juego. |
| **Atracción** | Solo en el final: es el premio, la órbita. |

Son **cinco herramientas, dos controles del tiempo y un interruptor**: siete u ocho botones en la barra, sin el menú «Más».

**Quedan fuera por ahora (vuelven como ampliaciones):** Vector y Sumar (la sonda), Superficie, Resorte, Medio, los lentes Energía y Gráficos, paso a paso, cámara lenta y línea de tiempo.

## 3. El juego simple: «Lanza y acierta»

Una sola mecánica que se repite y crece: **pon una partícula, dale velocidad, deja fluir el tiempo y alcanza algo.** Cada rastro tiene un objetivo visible (un punto, una boya, un blanco, una órbita), se puede fallar y se reintenta con t = 0.

### La historia en tres actos y siete rastros (≈ 13 minutos)

| Acto | # | Rastro | Objetivo de juego | La idea | Se gana |
| --- | --- | --- | --- | --- | --- |
| I · Dónde | 1 | El vacío | pon el origen y gira los ejes | los ejes son una elección | Origen |
| | 2 | Una partícula | dos partículas; mueve el origen | r depende de desde dónde se mide | Partícula, Mover |
| II · Cuándo | 3 | Desde siempre | apuesta dónde estará a t = 4 s | inercia: r = r₀ + v t | ▶, t = 0 |
| | 4 | La boya | alcánzala | se apunta a donde estará | Velocidad |
| III · Por qué | 5 | ¿Dónde es abajo? | elige hacia dónde es abajo; dos masas caen | todo cae igual | Gravedad |
| | 6 | Al blanco | acierta | en la cima, v no es cero | — |
| | 7 | En órbita (final) | que dé una vuelta sin caer | una caída que nunca llega | Atracción |

Cambios respecto de los rastros actuales (todos como variantes de datos, igual que en la demo):

- **«Dos saltos» (vectores) sale.** Es un buen rastro, pero trae su propia mecánica (la sonda) y dos herramientas que el resto del juego no usa. Vuelve en la primera ampliación.
- **«Al blanco» entra en lugar de «Dos saltos»:** es el rastro más «juego» de todos. En la versión simple solo pide acertar, y la pregunta de la cima se responde sin herramientas nuevas: tras acertar, el tiempo se detiene solo en el punto más alto y la flecha cian muestra la respuesta. Se quitan la línea de tiempo y el paso de los gráficos. Hoy detener el tiempo a mano en la cima no sirve: la ventana dura unos 0,04 s.
- **«¿Dónde es abajo?» sin cámara lenta:** el paso «elige ×½» sale. Las marcas cada 0,1 s ya muestran que cae cada vez más rápido.
- **«En órbita»** con la presentación de la atracción, como en la demo.

### Lo que se ve en pantalla

- **El mapa:** solo cuatro zonas (el claro, la deriva, el pozo y el astro) y sus siete rastros. Las otras seis zonas **no aparecen**, ni siquiera como puntos: lo que no se puede alcanzar, no está.
- **Sin árbol de herramientas:** la barra misma muestra lo que se tiene.
- **Bitácora:** se queda (una página por rastro) y se muestra entera al final como «tu cuaderno».
- **Estrellas:** como máximo tres por rastro (resolver, predecir bien y un reto), 21 en total. Son la razón para volver a jugar.
- **Laboratorio libre:** se abre recién al final, como premio, con las mismas siete herramientas.
- Se mantienen la pantalla de entrada, «Siguiente: …», «Rastro 3 de 7», el kiosco y «Empezar de nuevo» de la demo.

## 4. Cómo crece después

Cada ampliación es **una zona + una herramienta + dos o tres rastros + un desafío final**. El contenido ya existe en el juego completo y no se reescribe: solo se suma a la edición.

| # | Ampliación | Herramienta | Rastros (ya hechos) | Desafío final |
| --- | --- | --- | --- | --- |
| 1 | La constelación | Vector, Sumar | Dos saltos, El muro, Tres veces A | Los ejes de otra persona |
| 2 | Las laderas | Superficie | El suelo empuja, ¿Se queda o desliza? | La pendiente justa |
| 3 | El taller | Resorte | La ley del resorte, El ritmo | Al mismo compás |
| 4 | La central | lente Energía | Lo que no cambia, ¿Dónde está el cero? | Justo hasta arriba |
| 5 | El mar | Medio | La pluma y la piedra, Velocidad terminal | El paracaídas |
| 6 | El puente | (cuerpos rígidos) | La balanza, La palanca | La carrera |
| — | Cuaderno de mediciones | Gráficos, paso a paso, línea de tiempo, cámara lenta | Cuadro a cuadro, la cima de «Al blanco» | — |

Los demás rastros de cada zona del juego simple también vuelven como ampliaciones chicas, sin herramientas nuevas: «El rincón torcido» y «El mismo tiro en la Luna» en el pozo, y «Todo atrae a todo» y «Escapar» en el astro. Lo mismo vale para el resto de la central («Resorte y energía» y los tres de calor) y del puente («El péndulo que no es un punto»).

El cuaderno de mediciones conviene como ampliación para el curso: es lo que se usa en clase para medir, no lo que engancha al jugar.

## 5. Cómo se arma

La demo ya dejó la base: un modo aparte (`src/mode.ts`) que elige los rastros, sus variantes, las puertas, la tarjeta y el mapa sin tocar el juego completo. La edición simple sería **otra lista de datos** y no otro juego:

```ts
EDICION_SIMPLE = {
  zonas: ['claro', 'deriva', 'pozo', 'astro'],
  rastros: [vacio, particula, desdeSiempre, boya, abajo (sin cámara lenta), blanco (simple), orbita (con presentación)],
  ampliaciones: [],          // después: [constelacion, laderas, …]
}
```

Lo nuevo que hace falta:

1. Un gancho para que el mapa reciba solo las zonas de la edición (hoy `ZONES` está fijo en `Game`).
2. Ocultar el Árbol y el Lab hasta el final.
3. La variante simple de «Al blanco» (`sim.pauseAt` en la cima, que ya existe).
4. La lista de ampliaciones como datos, para sumar zonas sin tocar código.

Estimo una sesión para la edición simple y una sesión corta por ampliación.

## 6. Lo que necesito que decidas

1. **¿Dónde vive el juego simple?**
   - a. Reemplaza a la demo en `demo.html` (la demo ya es el 80 % de esto) y, si funciona, después pasa a ser la portada.
   - b. Es la portada desde ya (`index.html`) y el juego completo se mueve a `completo.html`.
2. **¿«Dos saltos» o «Al blanco»?** Recomiendo «Al blanco» en el juego simple y los vectores como primera ampliación. La otra opción es dejar «Dos saltos» y sacar «Al blanco».
3. **¿Sin cámara lenta en el pozo?** Recomiendo que sí, que salga.
