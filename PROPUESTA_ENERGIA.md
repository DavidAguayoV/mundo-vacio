# Mundo Vacío — Energía: lo que se conserva cuando todo cambia

Propuesta para revisar antes de programar. Es el nodo «próxima» del árbol después del capítulo 10. Mantiene el ritmo aprobado: pregunta → predecir → observar → idea → mirada de ingeniería.

## 1. Qué le falta a la historia hoy

1. **Todo se explica con fuerzas, paso a paso.** El jugador ya sabe por qué se mueven las cosas, pero no tiene una forma de responder rápido «¿hasta dónde llega?» o «¿con qué rapidez llega abajo?» sin seguir todo el movimiento. Ese atajo es la energía.
2. **Falta una cantidad que no cambie.** Los diez capítulos muestran cosas que cambian: r, v, a. La idea más poderosa de la mecánica es que, mientras todo eso cambia, hay una suma que no.
3. **El origen y los ejes quedaron en el Acto I.** La energía potencial es la ocasión perfecta para retomarlos: el cero de la energía potencial es una elección, como el origen.
4. **El roce y el arrastre «frenan» sin más.** No se dice adónde va lo que se pierde. La respuesta (calor) cierra la historia de las fuerzas de contacto.
5. **El nodo «Escalar y producto punto» del árbol sigue bloqueado sin un uso.** El trabajo, W = F · Δr, es el lugar natural para estrenarlo.

## 2. La idea: un lente de energía

Como el Tiempo, la energía no es una herramienta que se pone en el mundo: es una forma de mirarlo. El jugador gana el lente **Energía**, un interruptor en la barra que abre un medidor de barras del sistema completo:

| Barra | Qué es | Color (código físico de siempre) |
| --- | --- | --- |
| K | cinética, Σ ½ m v² | cian, como v |
| Ug | potencial gravitatoria, m g h | rosa, como g |
| Ue | elástica de los resortes, ½ k ΔL² | neutro |
| UG | de la atracción entre masas | neutro |
| Q | calor: lo que se llevaron el roce, el arrastre y los choques | gris |
| Total | la suma | línea horizontal sobre las barras |

Con la **línea de tiempo**, el medidor sigue al instante elegido: el jugador arrastra y ve cómo las barras se intercambian mientras el total queda quieto.

**Medir el calor por separado, no por diferencia.** Q se calcula sumando paso a paso la potencia del roce y del arrastre, más lo que pierde cada choque con una superficie (que en el juego es plástico). Así, si el total se mantiene, es porque la física lo cumple y no porque lo forzamos. Meta técnica: deriva del total menor que 0,1 % en los experimentos del capítulo (lo verifico con tests antes de mostrarlo).

## 3. Nuevo acto: IV · Qué se conserva

**11. Energía** *(nuevo)*: K y Ug en una caída y en un tiro; la suma no cambia. Se **predice** si el total sube, baja o se mantiene. Después se mueve el origen: Ug cambia en todo el vuelo, pero las diferencias no. Después, un resorte: K y Ue se pasan la energía de una a otra.

**12. ¿Adónde se fue?** *(nuevo)*: roce, arrastre y choques. La energía mecánica baja, pero aparece Q y el total con Q se mantiene. Se **predice** qué partícula llega más lejos en un plano con roce según su rapidez inicial. Cierra con la montaña rusa: «la primera subida es la más alta».

**13. Trabajo** *(opcional, decisión 4)*: se gana el producto punto en Vectores y se usa para W = F · Δr: el trabajo de cada fuerza es lo que cambia K. La normal no trabaja porque es perpendicular al desplazamiento, y el roce trabaja en contra.

Después del capítulo 12 (o 13) se vuelve al modo libre, ahora con el lente de energía.

## 4. Cómo lo contamos

### Ejemplo: capítulo 11, Energía

| # | Tarjeta | Se completa con |
| --- | --- | --- |
| 1 | Ya sabes cómo se mueve todo. Ahora una pregunta distinta: mientras r, v y a cambian, ¿hay algo que **no** cambie? Activa el lente **Energía** en la barra. | interruptor |
| 2 | La barra K es la **energía cinética**, ½ m v²: crece con la rapidez. La barra Ug es la **energía potencial gravitatoria**, m g h: crece con la altura. Antes de soltar la de 1 kg: ¿qué hace la suma? **[Crece] [Se mantiene] [Baja]** | elegir |
| 3 | Deja fluir el tiempo y mira las barras. | cae ≥ 1 m |
| 4 | K sube lo mismo que baja Ug: la suma se mantiene. Es la **conservación de la energía mecánica**. *(+ una línea según lo que predijo)* | Siguiente |
| 5 | Usa la línea de tiempo: en cualquier instante, el total es el mismo. Ahora lánzala hacia arriba con Velocidad. ¿Cambia algo? | un tiro |
| 6 | Si mueves el origen más abajo, ¿qué pasa con Ug? **[Cambia en todo el vuelo] [No cambia] [Cambia solo al final]** | elegir |
| 7 | Mueve el origen con Mover y vuelve a lanzar. | mover el origen |
| 8 | Ug cambió en todo el vuelo, y el total también, pero lo que gana K sigue siendo exactamente lo que pierde Ug. El cero de la energía potencial es una elección, como el origen del capítulo 1; lo que tiene sentido físico son las diferencias. | Siguiente |
| 9 | Cuelga la partícula de un resorte y déjala oscilar. Mira K y Ue. | oscila |
| 10 | K y Ue se pasan la energía de una a otra: K es máxima en el equilibrio y Ue en los extremos. La suma, otra vez, no cambia. | Siguiente |
| 11 | *Mirada de ingeniería* | Siguiente |

### Miradas de ingeniería propuestas

| Cap. | Idea |
| --- | --- |
| 11 | Una central hidroeléctrica convierte la energía potencial del agua de un embalse en electricidad: por eso importa tanto la altura de caída. |
| 12 | Un auto eléctrico frena con su motor y recupera parte de su energía cinética (freno regenerativo); con frenos de disco, esa energía se va en calor. |
| 13 | Un ascensor con contrapeso: el motor solo tiene que hacer el trabajo de la diferencia de masas. |

Alternativas por si prefieres otras: un arco que convierte energía elástica en cinética de la flecha; las pastillas de freno que se calientan; una montaña rusa que nunca vuelve a subir tan alto como la primera vez.

## 5. Lo técnico, en breve

- **Medidor**: K, Ug (con h medida a lo largo de −g desde el origen del jugador), Ue y UG (con el mismo suavizado que la fuerza, para que sea consistente), y Q acumulado.
- **Calor**: potencia del roce y del arrastre integrada en cada paso, y energía perdida en cada choque plástico (½ m v_n²) y al detenerse por roce estático.
- **Nuevo tipo de habilidad**: lente (`lens:energy`), un interruptor en la barra como Atracción y Medio, pero que no cambia la física; solo muestra.
- **Eventos nuevos** para el relato: lente activado, origen movido con un lanzamiento previo, energía disipada (Q > 0).
- **En el modo libre**: el lente está disponible y se agrega al panel del Lab.
- **Tests**: conservación en caída, tiro, oscilación y órbita (deriva < 0,1 %); total con Q constante con roce, arrastre y choques; Ug cambia en una constante al mover el origen.

## 6. Fases

- **E1. Medidor y capítulo 11**: el lente, las barras, la línea de tiempo y el capítulo Energía.
- **E2. Calor y capítulo 12**: medición de Q y el capítulo ¿Adónde se fue?
- **E3. Trabajo y capítulo 13** *(si lo apruebas)*: el producto punto en Vectores y el capítulo Trabajo.

Cada fase cierra igual que antes: tests en verde, build, push (se publica sola) y un resumen corto.

## 7. Decisiones que necesito de ti

1. ¿Un **Acto IV** («Qué se conserva») con dos capítulos, o un solo capítulo largo de Energía al final del Acto III?
2. ¿Medidor del **sistema completo** (recomendado: Ug y Ue son de pares, no de una partícula) o también por partícula?
3. ¿El **calor medido por separado** (recomendado) o la cuenta cerrada por diferencia?
4. ¿Incluimos ahora el capítulo **Trabajo** con el producto punto, o lo dejamos en la hoja de ruta?
5. ¿Te sirven las **miradas de ingeniería** propuestas, o prefieres alguna alternativa?
