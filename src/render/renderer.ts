import { fieldLayer } from './layers/field';
import { regionsLayer } from './layers/regions';
import { springsLayer } from './layers/springs';
import { surfacesLayer } from './layers/surfaces';
import { axesLayer, gridLayer } from './layers/frame';
import { particlesLayer, trailsLayer } from './layers/particles';
import { targetLayer } from './layers/target';
import { vectorsLayer } from './layers/vectors';
import { beaconsLayer, probeLayer } from './layers/probe';
import type { Layer, Scene } from './scene';

/** Orden de las capas, del fondo al frente. */
const LAYERS: Layer[] = [
  regionsLayer,
  gridLayer,
  fieldLayer,
  axesLayer,
  surfacesLayer,
  targetLayer,
  beaconsLayer,
  trailsLayer,
  springsLayer,
  vectorsLayer,
  probeLayer,
  particlesLayer,
  (s) => s.draft?.(s.painter),
];

export function drawScene(scene: Scene): void {
  const { ctx } = scene.painter;
  const { view } = scene;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.W, view.H);
  ctx.globalAlpha = 1;
  scene.painter.beginFrame(scene.avoid);
  for (const layer of LAYERS) layer(scene);
  // los rótulos al final, encima de todo y ubicados para no pisarse
  scene.painter.flushLabels();
}
