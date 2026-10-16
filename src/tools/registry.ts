import { GravityTool } from './gravity';
import { MoveTool } from './move';
import { OriginTool } from './origin';
import { ParticleTool } from './particle';
import { SpringTool } from './spring';
import { SumTool } from './sum';
import { SurfaceTool } from './surface';
import type { Tool, ToolId } from './tool';
import { VectorTool } from './vector';
import { VelocityTool } from './velocity';

/** Orden en la caja de herramientas. Agregar una herramienta nueva = una línea aquí + su archivo. */
export const TOOL_ORDER: ToolId[] = ['move', 'origin', 'particle', 'vector', 'sum', 'gravity', 'velocity', 'surface', 'spring'];

export function createTools(): Record<ToolId, Tool> {
  return {
    move: new MoveTool(),
    origin: new OriginTool(),
    particle: new ParticleTool(),
    vector: new VectorTool(),
    sum: new SumTool(),
    gravity: new GravityTool(),
    velocity: new VelocityTool(),
    surface: new SurfaceTool(),
    spring: new SpringTool(),
  };
}
