/**
 * Cache de frames decodificadas con ventana acotada.
 *
 * Dos cachés claramente separadas:
 *  - RED: las N frames se descargan una vez (fetch con `force-cache`) y
 *    viven en la cache HTTP del navegador. Cero red durante el scroll.
 *  - DECODIFICADA: solo una ventana pequeña alrededor de la frame objetivo
 *    (≈ 23 frames) existe como bitmap en memoria. Todo lo demás se cierra
 *    explícitamente (`ImageBitmap.close()`), sin depender del GC.
 *
 * Prioridad: la frame objetivo primero, luego sus vecinas por distancia,
 * con más margen en la dirección del scroll. Cambiar el objetivo
 * reconstruye la cola (los trabajos no iniciados y ya inútiles
 * desaparecen) y evicta lo que salió de la ventana. Un decode en curso
 * no se puede cancelar: al resolver, si ya no cabe en la ventana, se
 * cierra en el acto.
 *
 * Mismo motor en todas las plataformas: `createImageBitmap(blob)` con
 * fallback a `<img>` + `decode()` si el navegador no lo soporta.
 */

export type FrameSource = ImageBitmap | HTMLImageElement;

export interface FrameCacheOptions {
  total: number;
  src: (index: number) => string;
  /** Frames a mantener detrás / delante en la dirección del scroll. */
  behind: number;
  ahead: number;
  /** Decodes simultáneos como máximo. */
  concurrency: number;
  /** Se llama cuando una frame queda decodificada y dentro de la ventana. */
  onFrameReady?: (index: number) => void;
}

const supportsImageBitmap = typeof createImageBitmap === 'function';

async function decodeViaBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function decodeViaImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(() => resolve(img), reject);
      else resolve(img);
    };
    img.onerror = () => reject(new Error('image error'));
    img.src = url;
  });
}

async function decodeFrame(url: string): Promise<FrameSource> {
  if (supportsImageBitmap) {
    try {
      return await decodeViaBitmap(url);
    } catch {
      // cae al fallback
    }
  }
  return decodeViaImage(url);
}

function release(frame: FrameSource) {
  if ('close' in frame && typeof frame.close === 'function') frame.close();
}

export class FrameCache {
  private readonly decoded = new Map<number, FrameSource>();
  private readonly inFlight = new Set<number>();
  private queue: number[] = [];
  private target = 0;
  private direction: 1 | -1 = 1;
  private lo = 0;
  private hi = 0;
  private disposed = false;
  private idleWaiters: Array<() => void> = [];

  constructor(private readonly opts: FrameCacheOptions) {
    this.computeWindow();
  }

  /** Frame decodificada exacta, si está. */
  get(index: number): FrameSource | undefined {
    return this.decoded.get(index);
  }

  /** Frame decodificada más cercana a `index` (o null si no hay ninguna). */
  nearest(index: number): { index: number; frame: FrameSource } | null {
    const exact = this.decoded.get(index);
    if (exact) return { index, frame: exact };
    for (let d = 1; d < this.opts.total; d += 1) {
      const before = this.decoded.get(index - d);
      if (before) return { index: index - d, frame: before };
      const after = this.decoded.get(index + d);
      if (after) return { index: index + d, frame: after };
    }
    return null;
  }

  /** Nueva frame objetivo: reorienta la ventana, evicta, reprioriza la cola. */
  setTarget(index: number) {
    if (this.disposed) return;
    const clamped = Math.min(Math.max(index, 0), this.opts.total - 1);
    if (clamped !== this.target) this.direction = clamped > this.target ? 1 : -1;
    this.target = clamped;
    this.computeWindow();
    this.evict();
    this.rebuildQueue();
    this.pump();
  }

  /** Resuelve cuando no queda nada en cola ni en curso. */
  whenIdle(): Promise<void> {
    if (this.queue.length === 0 && this.inFlight.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  stats() {
    return {
      target: this.target,
      window: [this.lo, this.hi] as const,
      decoded: this.decoded.size,
      inFlight: this.inFlight.size,
      queued: this.queue.length,
    };
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    for (const frame of this.decoded.values()) release(frame);
    this.decoded.clear();
    this.resolveIdle();
  }

  // ---------------------------------------------------------------------

  private computeWindow() {
    const { behind, ahead, total } = this.opts;
    const back = this.direction === 1 ? behind : ahead;
    const front = this.direction === 1 ? ahead : behind;
    this.lo = Math.max(0, this.target - back);
    this.hi = Math.min(total - 1, this.target + front);
  }

  private inWindow(index: number) {
    return index >= this.lo && index <= this.hi;
  }

  /** ¿Hay alguna frame decodificada dentro de la ventana actual? */
  private hasDecodedInWindow() {
    for (const index of this.decoded.keys()) if (this.inWindow(index)) return true;
    return false;
  }

  /**
   * Cierra lo que salió de la ventana. Excepción: si la ventana nueva aún
   * no tiene ninguna frame decodificada (salto grande), se conserva UNA
   * frame ancla (la más cercana al objetivo) para que siempre haya algo
   * que pintar; se cierra en cuanto llega la primera frame de la ventana.
   */
  private evict() {
    const anchor = this.hasDecodedInWindow() ? null : this.nearest(this.target)?.index ?? null;
    for (const [index, frame] of this.decoded) {
      if (!this.inWindow(index) && index !== anchor) {
        release(frame);
        this.decoded.delete(index);
      }
    }
  }

  /** Cola ordenada por distancia al objetivo; solo frames de la ventana aún no listas. */
  private rebuildQueue() {
    const next: number[] = [];
    const span = Math.max(this.target - this.lo, this.hi - this.target);
    for (let d = 0; d <= span; d += 1) {
      const first = this.target + d * this.direction;
      const second = this.target - d * this.direction;
      if (this.inWindow(first)) next.push(first);
      if (d > 0 && this.inWindow(second)) next.push(second);
    }
    this.queue = next.filter((i) => !this.decoded.has(i) && !this.inFlight.has(i));
  }

  private pump() {
    while (!this.disposed && this.inFlight.size < this.opts.concurrency && this.queue.length > 0) {
      const index = this.queue.shift() as number;
      this.inFlight.add(index);
      decodeFrame(this.opts.src(index)).then(
        (frame) => this.settle(index, frame),
        () => this.settle(index, null),
      );
    }
  }

  private settle(index: number, frame: FrameSource | null) {
    this.inFlight.delete(index);
    if (frame) {
      if (this.disposed || !this.inWindow(index)) {
        release(frame); // llegó tarde: ya no es útil
      } else {
        this.decoded.set(index, frame);
        this.evict(); // suelta la frame ancla si la había
        this.opts.onFrameReady?.(index);
      }
    }
    this.pump();
    if (this.queue.length === 0 && this.inFlight.size === 0) this.resolveIdle();
  }

  private resolveIdle() {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  }
}
