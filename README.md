# Mundo Vacío

Juego e historia sobre física para primer año: se parte en un espacio vacío y se van desbloqueando herramientas (sistema de referencia, partículas, vectores, gravedad, velocidad…).

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

Atajos: espacio = Lanzar/Pausa, R = Reiniciar, Supr = eliminar la selección, Esc = deseleccionar.

## Laboratorio (modo libre)

Desde el árbol → «Modo libre», o al terminar el relato. El botón **Lab** de la caja de herramientas abre el panel:

- **Guardar aquí**: guarda el experimento en este navegador (se reemplaza si ya existe uno con el mismo nombre).
- **Descargar .json** y **Abrir archivo .json** (o arrastrar el archivo al lienzo): para llevarlo a otro equipo.
- **Copiar enlace**: el experimento va comprimido dentro del enlace (`#exp=…`); quien lo abre lo ve en su modo libre sin perder su avance en el relato.
- **Ejemplos**: caída de dos masas, tiro parabólico al blanco, el mismo tiro en la Luna, planos con roce, medir μₛ y suma en ejes girados.
- **Mundo**: |g| de la Tierra, la Luna o Marte, o sin gravedad; vaciar el mundo.
- **Vista**: cámara lenta (×½, ×¼) y ocultar los vectores r o la trayectoria cuando hay muchas partículas.

Siempre se guarda el mundo como estaba al lanzar, no a mitad de vuelo. El relato y el laboratorio tienen cada uno su mundo, que se autoguarda en el navegador.

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy.yml` corre los tests, construye y publica `dist/` al hacer push a `main`. En el repositorio: Settings → Pages → Source: GitHub Actions. El build usa rutas relativas, así que funciona en `https://<usuario>.github.io/<repo>/`.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `src/physics` | RK4 de sistema con paso fijo (1/240 s), fuerzas (`Force`), simulación con acumulador y estroboscopio |
| `src/physics/constraints` | superficies rígidas: choque plástico, contacto, separación; la normal y el roce (`forces/normal.ts`, `forces/friction.ts`) leen esos contactos |
| `src/world` | entidades serializables, sistema de referencia del usuario (`toUser` / `toGlobal`) |
| `src/render` | cámara, paleta desde los tokens CSS, capas del lienzo |
| `src/tools` | herramientas como plugins (`Tool`), una por archivo |
| `src/story` | capítulos como datos (`Chapter`, `Step`), el motor que avanza con los eventos del juego y `RunMonitor`, que traduce cada lanzamiento en eventos (cayó, se apoyó, la sostiene el roce, desliza) |
| `src/lab` | experimentos (formato, enlaces, biblioteca local, ejemplos) y el panel del laboratorio |
| `src/tree` | árbol de habilidades |
| `src/ui` | tarjeta de relato, caja de herramientas, inspector, HUD |

Agregar un capítulo: un objeto más en `src/story/chapters.ts`. Agregar una herramienta: un archivo en `src/tools/` y una línea en `registry.ts`. Agregar una fuerza: una clase que implemente `Force` en `src/physics/forces/`.

El prototipo original de un archivo está en `mundo-vacio.html`.
