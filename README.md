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

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy.yml` corre los tests, construye y publica `dist/` al hacer push a `main`. En el repositorio: Settings → Pages → Source: GitHub Actions. El build usa rutas relativas, así que funciona en `https://<usuario>.github.io/<repo>/`.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `src/physics` | RK4 de sistema con paso fijo (1/240 s), fuerzas (`Force`), simulación con acumulador y estroboscopio |
| `src/world` | entidades serializables, sistema de referencia del usuario (`toUser` / `toGlobal`) |
| `src/render` | cámara, paleta desde los tokens CSS, capas del lienzo |
| `src/tools` | herramientas como plugins (`Tool`), una por archivo |
| `src/story` | capítulos como datos (`Chapter`, `Step`) y el motor que avanza con los eventos del juego |
| `src/tree` | árbol de habilidades |
| `src/ui` | tarjeta de relato, caja de herramientas, inspector, HUD |

Agregar un capítulo: un objeto más en `src/story/chapters.ts`. Agregar una herramienta: un archivo en `src/tools/` y una línea en `registry.ts`. Agregar una fuerza: una clase que implemente `Force` en `src/physics/forces/`.

El prototipo original de un archivo está en `mundo-vacio.html`.
