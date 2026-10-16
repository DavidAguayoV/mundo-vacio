// Eventos del juego. El relato escucha estos eventos para avanzar; las herramientas y la simulación los emiten.

export type GameEvent =
  | { type: 'origin-placed' }
  | { type: 'origin-moved' }
  | { type: 'frame-rotated' }
  | { type: 'particle-placed' }
  | { type: 'mass-changed' }
  | { type: 'vector-drawn' }
  | { type: 'sum-done' }
  | { type: 'g-set' }
  | { type: 'fell' }
  | { type: 'v-set' }
  | { type: 'target-hit' }
  | { type: 'surface-drawn' }
  | { type: 'landed' }
  | { type: 'held' }
  | { type: 'slid' }
  | { type: 'time-paused' }
  | { type: 'time-step' }
  | { type: 'slow-set' }
  | { type: 'coasted' }
  | { type: 'peak-found' }
  | { type: 'spring-made' }
  | { type: 'spring-stretched' }
  | { type: 'oscillated' }
  | { type: 'gravitation-on' }
  | { type: 'orbited' }
  | { type: 'escaped' }
  | { type: 'next' };

export type GameEventType = GameEvent['type'];

type Listener<E> = (ev: E) => void;

export class EventBus<E extends { type: string }> {
  private listeners: Listener<E>[] = [];

  on(fn: Listener<E>): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  emit(ev: E): void {
    for (const l of [...this.listeners]) l(ev);
  }
}
