# Prompt para Claude Code — Mundo Vacío

Abre Claude Code en esta carpeta y pega lo siguiente:

---

Quiero construir "Mundo Vacío": una página web que es a la vez juego e historia sobre física. El jugador parte en un espacio vacío y va desbloqueando herramientas (sistema de referencia, partículas, vectores, gravedad, velocidad, superficies, fuerzas…) mientras hace experimentos virtuales. La idea central: la física es nuestra forma de explicar cómo funcionan las cosas, y la ingeniería es mirar el mundo con esos ojos. Soy profesor de física universitaria (mecánica); el público son estudiantes de primer año.

En la carpeta hay un prototipo de un solo archivo (mundo-vacio.html). Úsalo como referencia de tono, flujo y estética, pero rehaz el proyecto con una arquitectura que escale.

## Stack
- Vite + TypeScript, Canvas 2D, sin framework de UI (o uno mínimo si lo justificas).
- Build estático desplegable en GitHub Pages.
- Funciona con mouse y táctil (pointer events) y en celular.
- Todo el texto en español. Decimales con coma y componentes separadas por punto y coma: (1,20 ; −0,50) m.

## Arquitectura (módulos separados)
1. Motor físico
   - Estado por partícula: posición, velocidad y masa, en metros y SI.
   - Integrador RK4 con paso fijo (1/240 s) y acumulador de tiempo real.
   - Registro de fuerzas: cada fuerza es un objeto con force(partícula, estado, mundo) → vector. Gravedad uniforme primero; deja preparado el espacio para resorte, normal, roce, arrastre y gravitación entre masas.
   - Restricciones y colisiones con superficies como módulo aparte (fase 2).
2. Mundo: partículas, vectores libres, sumas, campo g, blancos y superficies. Debe ser serializable a JSON para guardar y cargar experimentos.
3. Sistema de referencia: origen y ángulo elegidos por el usuario. Toda la física corre en coordenadas globales, pero todo lo que se muestra (componentes, r, v, g) se expresa en los ejes del usuario.
4. Herramientas como plugins con una interfaz común: onPointerDown/Move/Up, render del borrador, ícono y nombre.
5. Relato basado en datos: capítulos definidos en un archivo (JSON o TS) con título, herramientas que desbloquea y pasos. Cada paso tiene texto, el evento que lo completa, una condición opcional y un hook enter(). El juego emite eventos (origin-placed, frame-rotated, particle-placed, origin-moved, vector-drawn, sum-done, g-set, fell, v-set, target-hit…).
6. Árbol de habilidades: nodos con estado disponible, próxima o bloqueada, organizados por niveles.
7. Render: capa de mundo (malla de 1 m alineada a los ejes del usuario, ejes con ticks, flechas, trayectorias estroboscópicas cada 0,1 s) y UI en HTML encima.
8. Progreso en localStorage, más un "modo libre" que desbloquea todo para usarlo como laboratorio en clase.

## Capítulos de la primera versión
1. El vacío: fijar el origen y girar los ejes ("nadie dijo que x apunte a la derecha").
2. Una partícula: colocar partículas con masa y ver el vector posición r. Al mover el origen, r cambia y la partícula no.
3. Vectores: dibujar, ver componentes, sumar cola con punta. Al girar los ejes, la suma no cambia y sus componentes sí.
4. ¿Dónde es abajo?: el usuario arrastra la dirección de g y lanza. Al cambiar la masa, la caída es igual.
5. Velocidad: dar v₀ arrastrando desde la partícula y acertar a un blanco. Durante el vuelo, v cambia y g no.

Hoja de ruta (se ve en el árbol, todavía bloqueada): Superficie → Normal → Roce; Resorte; Gravitación entre masas (órbitas); Arrastre; Marco acelerado; 3D.

## Diseño
- Minimalista, oscuro por defecto con tema claro. El lienzo vacío es el protagonista.
- Código de colores físico consistente: posición en neutro, vectores y fuerzas en ámbar, velocidad en cian, aceleración y g en rosa.
- Tarjeta de relato contraíble arriba, caja de herramientas abajo, inspector del objeto seleccionado (masa con +/−, r, v, componentes, magnitud, ángulo).
- Tipografía: una serif con carácter para los títulos, una sans para el texto y una mono para los números.

## Calidad
- Tests (Vitest) del motor:
  - el proyectil con RK4 coincide con la solución analítica (error < 1e-6 m a los 2 s);
  - un oscilador armónico conserva la energía en 60 s (deriva < 0,1 %);
  - la conversión entre coordenadas globales y del usuario es reversible.
- Sin dependencias pesadas. 60 fps en un celular promedio con 50 partículas.

## Forma de trabajo
Primero entrégame un plan breve: estructura de carpetas, interfaces clave (Force, Tool, Chapter, Step) y fases. Espera mi visto bueno antes de programar. Después implementa por fases:
- Fase 1: motor + mundo + render + capítulos 1–5 con paridad con el prototipo.
- Fase 2: superficies con fuerza normal y roce (capítulo 6).
- Fase 3: guardar y cargar experimentos, y modo libre completo.

Al final de cada fase: tests en verde, `npm run build` sin errores y un resumen corto de lo que cambió.
