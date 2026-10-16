# Mundo Vacío — Plan de arquitectura

Plan breve para revisar antes de programar. El prototipo `mundo-vacio.html` queda intacto como referencia de tono, flujo y estética.

## Estructura de carpetas

```
mundo_vacio/
  index.html                 shell: lienzo + contenedores de UI
  package.json  tsconfig.json  vite.config.ts   (base: './' para GitHub Pages)
  .github/workflows/deploy.yml                   build y publicación en Pages
  src/
    main.ts                  arranque: crea mundo, simulador, render, UI y relato, y los conecta
    core/
      vec.ts                 Vec2 y operaciones (add, scale, rot, dot, len)
      format.ts              números en es-CL: 1,20 · (1,20 ; −0,50) m · signo menos real
      events.ts              bus de eventos tipado (GameEvent)
    physics/
      state.ts               SystemState: arreglos pos/vel/masa de todas las partículas
      integrator.ts          RK4 sobre el sistema completo
      simulation.ts          paso fijo 1/240 s, acumulador de tiempo real, estroboscopio cada 0,1 s
      forces/
        force.ts             interfaz Force y registro
        uniformGravity.ts    m·g (fase 1)
        spring.ts drag.ts gravitation.ts   esqueletos tipados, sin registrar todavía
      constraints/           (fase 2) superficies, normal y roce
    world/
      world.ts               partículas, vectores libres, sumas, campo g, blancos, superficies
      frame.ts               ReferenceFrame: origen + ángulo; toUser()/toGlobal()
      serialize.ts           JSON versionado (schema v1) para guardar/cargar experimentos
    render/
      view.ts                cámara: metros ↔ píxeles, DPR, escala "1 cuadro = 1 m"
      theme.ts               lee los tokens CSS (colores físicos) y reacciona al tema
      renderer.ts            orden de capas
      layers/                grid, axes, gField, target, vectors, sums, trails, particles, draft
    tools/
      tool.ts                interfaz Tool y ToolContext
      registry.ts            catálogo y orden de la caja de herramientas
      move.ts origin.ts particle.ts vector.ts sum.ts gravity.ts velocity.ts
      icons.ts               SVG en línea
    story/
      types.ts               Chapter, Step, StoryContext
      chapters.ts            capítulos 1–5 como datos
      storyEngine.ts         escucha el bus, evalúa condiciones, avanza, llama enter()
    tree/
      skills.ts              nodos por nivel (I Espacio … VI Marcos)
      treeView.ts            overlay del árbol
    ui/
      card.ts toolbar.ts inspector.ts hud.ts toast.ts
      styles.css             tokens de color y tipografía, claro/oscuro
    state/
      progress.ts            localStorage versionado + modo libre
  tests/
    rk4.projectile.test.ts   error < 1e-6 m a los 2 s
    sho.energy.test.ts       deriva de energía < 0,1 % en 60 s
    frame.test.ts            toUser(toGlobal(v)) = v
    format.test.ts           coma decimal y separador " ; "
```

Sin framework de UI: los paneles son pocos y simples, y DOM directo con un par de helpers pesa menos que cualquier librería y no pelea con el bucle del lienzo. Dependencias de ejecución: ninguna. Desarrollo: Vite, TypeScript, Vitest.

## Interfaces clave

```ts
type Vec2 = { x: number; y: number };           // metros o SI, siempre en coordenadas globales

interface Particle {
  id: string; label: string;                     // "1", "2", …
  pos: Vec2; vel: Vec2; mass: number;            // m, m/s, kg
}

// Estado del sistema completo en una etapa de RK4.
// Las fuerzas reciben el estado de TODAS las partículas, no solo la propia:
// así resorte y gravitación entre masas usan posiciones consistentes en k1…k4.
interface SystemState { pos: Vec2[]; vel: Vec2[]; mass: number[]; t: number }

interface Force {
  readonly kind: 'gravity' | 'spring' | 'drag' | 'gravitation' | 'normal' | 'friction';
  force(i: number, s: SystemState, world: World): Vec2;   // N, global
  toJSON(): ForceJSON;
}
// aceleración_i = Σ force(i, s, w) / masa_i

interface ReferenceFrame {
  origin: Vec2; angle: number;                   // rad, eje x del usuario respecto al global
  toUser(v: Vec2): Vec2;  toGlobal(v: Vec2): Vec2;          // vectores libres
  pointToUser(p: Vec2): Vec2; pointToGlobal(p: Vec2): Vec2; // puntos (restan el origen)
}

interface Tool {
  id: ToolId; name: string; icon: string;
  onActivate?(ctx: ToolContext): void;
  onPointerDown(p: WorldPointer, ctx: ToolContext): void;
  onPointerMove(p: WorldPointer, ctx: ToolContext): void;
  onPointerUp(p: WorldPointer, ctx: ToolContext): void;
  renderDraft?(r: DraftRenderer, ctx: ToolContext): void;  // flecha en construcción, etc.
}
// WorldPointer: posición en metros (global) + radio de toque en metros (más grande en táctil).
// ToolContext: world, frame, view, selection, sim (play/pause/reset), emit(ev), toast(msg).

type GameEvent =
  | { type: 'origin-placed' } | { type: 'origin-moved' } | { type: 'frame-rotated' }
  | { type: 'particle-placed' } | { type: 'mass-changed' }
  | { type: 'vector-drawn' } | { type: 'sum-done' }
  | { type: 'g-set' } | { type: 'fell' } | { type: 'v-set' } | { type: 'target-hit' }
  | { type: 'next' };                            // botón "Siguiente" de la tarjeta

interface Step {
  text: string;
  on: GameEvent['type'] | 'end';
  when?(ctx: StoryContext): boolean;             // condición opcional (ej. ≥ 2 partículas)
  enter?(ctx: StoryContext): void;               // hook al entrar (ej. aparece el blanco)
}

interface Chapter {
  id: string; title: string;
  unlocks: ToolId[];
  sim?: boolean;                                 // muestra Lanzar/Reiniciar
  seed?(ctx: StoryContext): void;                // estado mínimo si se retoma a mitad
  steps: Step[];
}

interface SkillNode {
  id: string; name: string; desc: string; tier: number;
  tool?: ToolId;                                 // si ya existe en el juego
  requires?: string[];                           // Superficie → Normal → Roce
}
// estado derivado: 'disponible' | 'próxima' | 'bloqueada'
```

## Fases

**Fase 1 — paridad con el prototipo**
1. Andamiaje Vite + TS + Vitest + workflow de Pages.
2. Motor: Vec2, RK4 de sistema, simulación con acumulador, gravedad uniforme, y los tres tests del motor.
3. Mundo y marco de referencia: entidades, conversiones, serialización (aunque guardar/cargar en UI llega en fase 3).
4. Render: cámara, malla de 1 m alineada a los ejes del usuario, ejes con ticks, flechas, campo g, trayectorias estroboscópicas.
5. Herramientas como plugins: Mover, Origen, Partícula, Vector, Sumar, Gravedad, Velocidad.
6. UI: tarjeta contraíble, caja de herramientas, inspector (masa ±, r, v, componentes, magnitud, ángulo), HUD, toast, tema claro/oscuro.
7. Relato: capítulos 1–5 como datos + motor de relato + árbol con la hoja de ruta bloqueada + progreso en localStorage.
8. Prueba de rendimiento con 50 partículas.

**Fase 2 — contacto (capítulo 6)**: superficies como segmentos; detección de contacto, fuerza normal como restricción y roce estático/cinético con μₑ y μc; vectores N y f dibujados en ámbar; capítulo 6 en el relato.

**Fase 3 — laboratorio**: guardar/cargar experimentos (archivo JSON y ranuras locales), modo libre completo con todas las herramientas y la opción de reiniciar o compartir un experimento.

Cada fase cierra con tests en verde, `npm run build` sin errores y un resumen corto.

## Decisiones que asumo (cámbialas si no te sirven)

- **g = 9,80 m/s²** por defecto, como en el prototipo.
- **Fuerzas, no aceleraciones**: el motor suma fuerzas y divide por la masa. Con gravedad uniforme el resultado es idéntico al prototipo, y deja el camino listo para resorte, roce y gravitación.
- **Fuentes autoalojadas** (Instrument Serif, IBM Plex Sans y Plex Mono, vía @fontsource) para que funcione sin internet en la sala de clases.
- **Vista fija** como en el prototipo (sin zoom ni paneo) en la fase 1; el módulo `view.ts` queda listo para agregar pellizco y rueda después.
- **Dropbox**: marcaré `node_modules` y `dist` como ignorados por Dropbox para que no sincronice miles de archivos.
- **Git**: inicializo un repositorio local; no creo el repositorio en GitHub ni hago push sin que me lo pidas.
