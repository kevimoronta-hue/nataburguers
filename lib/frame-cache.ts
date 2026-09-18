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
 * Dos modos de almacenamiento, elegidos por capacidad del dispositivo
 * (ver MobileFrameSequenceIntro), nunca por plataforma:
 *  - 'bitmap' (estándar: iPhone y móviles potentes): `<img>.decode()` y
 *    copia a `ImageBitmap`; ventana estricta; `close()` al salir de ella.
 *  - 'image' (lite: poca RAM / CPU lenta): la frame se conserva como
 *    `<img>` sin copia (cero trabajo de bitmap en el hilo principal);
 *    Chrome gestiona los píxeles decodificados en su caché descartable,
 *    como el motor original. Retención LRU (`retain` frames, encodadas,
 *    ~60 KB cada una) más allá de la ventana de pre-decode, para que un
 *    ida-y-vuelta no vuelva a decodificar nada.
 */

export type FrameSource = ImageBitmap | HTMLImageElement;

export type FrameStorage = 'bitmap' | 'image';

export interface FrameCacheOptions {
  total: number;
  src: (index: number) => string;
  /** Frames a pre-decodificar detrás / delante en la dirección del scroll. */
  behind: number;
  ahead: number;
  /** Decodes simultáneos como máximo. */
  concurrency: number;
  /** 'bitmap' (estándar) | 'image' (lite). */
  storage: FrameStorage;
  /** Solo 'image': máximo de frames retenidas (LRU). Sin valor = ventana estricta. */
  retain?: number;
  /** Se llama cuando una frame queda decodificada y dentro de la ventana. */
  onFrameReady?: (index: number) => void;
}

const supportsImageBitmap = typeof createImageBitmap === 'function';

/**
 * Velocidad (frames/ms) a partir de la cual la ventana se vuelca hacia
 * delante: con el mismo presupuesto de frames, menos detrás y más
 * delante, para que un fling encuentre frames ya decodificadas.
 * 0.12 frames/ms ≈ 120 frames/s ≈ un swipe normal-rápido en 450vh.
 */
const FAST_VELOCITY = 0.12;
/** En modo rápido se conservan como mínimo estas frames detrás. */
const FAST_MIN_BEHIND = 3;

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

/**
 * Decode de una frame:
 *  1. `<img>` + `decode()`: el navegador decodifica fuera del hilo
 *     principal (WebKit y Chrome);
 *  2. copia a `ImageBitmap` (`createImageBitmap(img)`, sin volver a
 *     decodificar): memoria propia, NO descartable por la caché de
 *     imágenes del navegador (Chrome purga los `<img>` decodificados que
 *     no están en el documento y los vuelve a decodificar en `drawImage`,
 *     en el hilo principal: ahí estaba el "tirón" en Android) y liberable
 *     con `close()` en el acto.
 * Si no hay `createImageBitmap`, se conserva el `<img>`.
 */
async function decodeFrame(url: string, storage: FrameStorage): Promise<FrameSource> {
  const img = await decodeViaImage(url);
  if (storage === 'image' || !supportsImageBitmap) return img;
  try {
    const bitmap = await createImageBitmap(img);
    img.src = '';
    return bitmap;
  } catch {
    return img;
  }
}

/**
 * Libera la frame. ImageBitmap: `close()` explícito. `<img>` (lite): solo
 * se suelta la referencia — no se fuerza a Chrome a tirar su caché.
 */
function release(frame: FrameSource) {
  if ('close' in frame && typeof frame.close === 'function') frame.close();
}

export class FrameCache {
  private readonly decoded = new Map<number, FrameSource>();
  private readonly inFlight = new Set<number>();
  /** Último uso por frame (tick lógico), para la retención LRU en modo lite. */
  private readonly lastUsed = new Map<number, number>();
  private readonly everDecoded = new Set<number>();
  private tick = 0;
  private queue: number[] = [];
  private target = 0;
  private direction: 1 | -1 = 1;
  private fast = false;
  private lastTargetAt = 0;
  private lo = 0;
  private hi = 0;
  private disposed = false;
  private idleWaiters: Array<() => void> = [];

  // Contadores (debug): coste real del motor en el dispositivo.
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private redecodes = 0;
  private decodeCount = 0;
  private decodeMsTotal = 0;
  private maxDistance = 0;

  private readonly opts: FrameCacheOptions;

  constructor(opts: FrameCacheOptions) {
    this.opts = { ...opts };
    this.computeWindow();
  }

  private touch(index: number) {
    this.tick += 1;
    this.lastUsed.set(index, this.tick);
  }

  /** Frame decodificada exacta, si está. */
  get(index: number): FrameSource | undefined {
    return this.decoded.get(index);
  }

  /** Frame decodificada más cercana a `index` (o null si no hay ninguna). Cuenta hit/miss. */
  nearest(index: number): { index: number; frame: FrameSource } | null {
    const exact = this.decoded.get(index);
    if (exact) {
      this.hits += 1;
      this.touch(index);
      return { index, frame: exact };
    }
    this.misses += 1;
    for (let d = 1; d < this.opts.total; d += 1) {
      const before = this.decoded.get(index - d);
      if (before) {
        this.maxDistance = Math.max(this.maxDistance, d);
        this.touch(index - d);
        return { index: index - d, frame: before };
      }
      const after = this.decoded.get(index + d);
      if (after) {
        this.maxDistance = Math.max(this.maxDistance, d);
        this.touch(index + d);
        return { index: index + d, frame: after };
      }
    }
    return null;
  }

  /**
   * Nueva frame objetivo: reorienta la ventana (dirección y velocidad),
   * evicta, reprioriza la cola. La velocidad no cambia el presupuesto de
   * frames, solo su reparto detrás/delante.
   */
  setTarget(index: number) {
    if (this.disposed) return;
    const clamped = Math.min(Math.max(index, 0), this.opts.total - 1);
    const now = performance.now();
    if (clamped !== this.target) {
      this.direction = clamped > this.target ? 1 : -1;
      const dt = now - this.lastTargetAt;
      const velocity = dt > 0 ? Math.abs(clamped - this.target) / dt : 0;
      this.fast = velocity >= FAST_VELOCITY;
      this.lastTargetAt = now;
    } else if (now - this.lastTargetAt > 250) {
      this.fast = false; // parado: ventana equilibrada otra vez
    }
    this.target = clamped;
    this.computeWindow();
    this.evict();
    this.rebuildQueue();
    this.pump();
  }

  /**
   * Primera carga: el primer gesto es casi siempre un swipe hacia abajo,
   * así que la ventana inicial se vuelca entera hacia delante.
   */
  prime(index: number) {
    this.fast = true;
    this.direction = 1;
    this.lastTargetAt = performance.now();
    this.setTarget(index);
  }

  /**
   * Cambia de perfil en caliente (p. ej. estándar → lite tras medir el
   * decode real en el loader). Las frames ya decodificadas se conservan
   * tal cual (bitmap o <img>); solo cambian ventana, concurrencia,
   * retención y el modo de las decodificaciones futuras.
   */
  reconfigure(
    next: Partial<Pick<FrameCacheOptions, 'src' | 'behind' | 'ahead' | 'concurrency' | 'storage' | 'retain'>>,
  ) {
    Object.assign(this.opts, next);
    this.computeWindow();
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
      storage: this.opts.storage,
      target: this.target,
      window: [this.lo, this.hi] as const,
      fast: this.fast,
      decoded: this.decoded.size,
      inFlight: this.inFlight.size,
      queued: this.queue.length,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      redecodes: this.redecodes,
      decodeMsAvg: this.decodeCount ? Math.round(this.decodeMsTotal / this.decodeCount) : 0,
      maxDistance: this.maxDistance,
    };
  }

  dispose() {
    this.disposed = true;
    this.queue = [];
    for (const frame of this.decoded.values()) release(frame);
    this.decoded.clear();
    this.lastUsed.clear();
    this.resolveIdle();
  }

  // ---------------------------------------------------------------------

  private computeWindow() {
    const { behind, ahead, total } = this.opts;
    // Mismo presupuesto (behind + ahead) siempre; en rápido casi todo delante.
    const budget = behind + ahead;
    const back = this.fast ? FAST_MIN_BEHIND : behind;
    const front = budget - back;
    let lo = this.direction === 1 ? this.target - back : this.target - front;
    let hi = this.direction === 1 ? this.target + front : this.target + back;
    // En los extremos de la secuencia el presupuesto que no cabe por un
    // lado se traslada al otro (p. ej. al inicio: frames 0-22, no 0-19).
    if (lo < 0) {
      hi += -lo;
      lo = 0;
    }
    if (hi > total - 1) {
      lo -= hi - (total - 1);
      hi = total - 1;
    }
    this.lo = Math.max(0, lo);
    this.hi = Math.min(total - 1, hi);
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
    const { retain } = this.opts;
    if (retain !== undefined) {
      // Lite / LRU: la ventana solo decide qué pre-decodificar. Se retiene
      // todo hasta `retain` frames; por encima, se sueltan las menos usadas
      // que estén fuera de la ventana (las de la ventana nunca se tocan).
      if (this.decoded.size <= retain) return;
      const candidates = [...this.decoded.keys()]
        .filter((index) => !this.inWindow(index))
        .sort((a, b) => (this.lastUsed.get(a) ?? 0) - (this.lastUsed.get(b) ?? 0));
      let excess = this.decoded.size - retain;
      for (const index of candidates) {
        if (excess <= 0) break;
        const frame = this.decoded.get(index);
        if (frame) release(frame);
        this.decoded.delete(index);
        this.lastUsed.delete(index);
        this.evictions += 1;
        excess -= 1;
      }
      return;
    }

    // Estándar: ventana estricta. Excepción: una frame ancla mientras la
    // ventana nueva aún no tiene ninguna frame decodificada (salto grande).
    const anchor = this.hasDecodedInWindow() ? null : this.nearestIndex(this.target);
    for (const [index, frame] of this.decoded) {
      if (!this.inWindow(index) && index !== anchor) {
        release(frame);
        this.decoded.delete(index);
        this.lastUsed.delete(index);
        this.evictions += 1;
      }
    }
  }

  /** Índice decodificado más cercano (sin contar hit/miss). */
  private nearestIndex(index: number): number | null {
    if (this.decoded.has(index)) return index;
    for (let d = 1; d < this.opts.total; d += 1) {
      if (this.decoded.has(index - d)) return index - d;
      if (this.decoded.has(index + d)) return index + d;
    }
    return null;
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
      if (this.everDecoded.has(index)) this.redecodes += 1;
      this.everDecoded.add(index);
      const startedAt = performance.now();
      decodeFrame(this.opts.src(index), this.opts.storage).then(
        (frame) => {
          this.decodeCount += 1;
          this.decodeMsTotal += performance.now() - startedAt;
          this.settle(index, frame);
        },
        () => this.settle(index, null),
      );
    }
  }

  private settle(index: number, frame: FrameSource | null) {
    this.inFlight.delete(index);
    if (frame) {
      // Estándar: fuera de la ventana ya no es útil. Lite (LRU): se guarda
      // igualmente, es una frame reciente.
      if (this.disposed || (this.opts.retain === undefined && !this.inWindow(index))) {
        release(frame);
      } else {
        this.decoded.set(index, frame);
        this.touch(index);
        this.evict(); // suelta la ancla (estándar) o el exceso LRU (lite)
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
