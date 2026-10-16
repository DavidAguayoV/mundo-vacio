// Escalas de dibujo de magnitudes que no son longitudes. Las comparten el render y las herramientas.

/** metros de flecha por cada m/s */
export const VEL_SCALE = 0.2;
/** metros de flecha por cada m/s² */
export const ACC_SCALE = 0.12;
/** rapidez máxima que se puede dar con la herramienta Velocidad, m/s */
export const MAX_SPEED = 25;
/** distancia del origen al asa que gira los ejes, m */
export const HANDLE_DIST = 3;

/** Radio en píxeles con que se dibuja una partícula de masa m (crece con ∛m, como el radio de una esfera). */
export const particleRadiusPx = (m: number): number => 4 + 3 * Math.cbrt(m);
