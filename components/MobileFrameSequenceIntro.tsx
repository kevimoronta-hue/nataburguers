/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FrameCache, type FrameSource } from '@/lib/frame-cache';
import { lockScroll, scrollToSection, unlockScroll } from '@/lib/scroll';

/**
 * Intro por secuencia de frames pilotada por scroll — EXCLUSIVA de mobile
 * (<=767px). En desktop este componente no monta nada.
 *
 * Una sola mecánica, sin ramas por plataforma:
 *
 *  SECUENCIA — la posición real de scroll es la única fuente de verdad.
 *    scroll → progress → frame index → drawImage. Sin estado histórico
 *    que decida la frame: ni "saltado", ni "terminado", ni "segundo
 *    pase". Subir = frames hacia atrás; bajar = frames hacia delante.
 *
 *  MEMORIA — las 193 frames se descargan una vez (cache HTTP), pero solo
 *    una ventana de ~23 frames alrededor del objetivo está decodificada
 *    (ImageBitmap, ~130 MB máx.), con más margen en la dirección del
 *    scroll. Lo que sale de la ventana se cierra en el acto. Si la frame
 *    exacta aún no está lista se pinta la decodificada más cercana y se
 *    sustituye en cuanto llega (latest-position-wins, nunca vacío). Ver
 *    lib/frame-cache.ts. Mismo motor en Android e iOS.
 *
 *  ANCLAJE — 100 % CSS: un spacer de 450vh con un hijo sticky de 100dvh.
 *    `vh` (viewport grande, constante) fija la longitud del recorrido y
 *    la posición del contenido que sigue; `dvh` absorbe la barra dinámica
 *    de Safari. El único JS de "viewport" es dimensionar el bitmap del
 *    canvas al tamaño real que le da el CSS (ResizeObserver).
 *
 *  CONTENIDO POST-INTRO — main/footer se revelan UNA vez al montar (clase
 *    one-way en <html>, con el loader aún tapando la pantalla). El layout
 *    completo de la página y las animaciones de entrada del Hero se pagan
 *    en segundo plano al principio, nunca en un tap ni en un rewind. La
 *    barra del pedido (fixed) solo se muestra cuando la intro ya salió por
 *    arriba (`nb-past-intro`, un booleano que mantiene el render loop).
 *
 *  SALTAR INTRO — síncrono: tap → scrollToSection('inicio') → render().
 *    No espera nada: la destino ya está maquetada (reveal al montar) y sus
 *    imágenes decodificadas (loader). Idempotente: cada clic ejecuta
 *    exactamente lo mismo, sea cual sea la frame o el historial.
 *
 *  LOADER — antes de soltar la experiencia: 193 frames descargadas
 *    (cache HTTP), primera ventana decodificada, fuentes listas, imágenes
 *    visibles al aterrizar tras el skip (logo del header, burger del Hero)
 *    decodificadas.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const TOTAL_FRAMES = 193;
const LAST_INDEX = TOTAL_FRAMES - 1;
const SCROLL_VH = 450;

/** La navbar aparece sobre las últimas frames (168 → 184, 1-based). */
const NAVBAR_START_INDEX = 167;
const NAVBAR_END_INDEX = 183;

const FETCH_CONCURRENCY = 6;
const MAX_RETRIES = 3;
/** Reparto del progreso mostrado: el fetch (red) y luego la primera ventana (decode). */
const FETCH_PROGRESS_SHARE = 0.85;

/** Ventana decodificada: objetivo + 8 detrás + 14 delante (en la dirección del scroll). */
const WINDOW_BEHIND = 8;
const WINDOW_AHEAD = 14;
const DECODE_CONCURRENCY = 4;

/** Clase one-way en <html>: main/footer están en el flujo. */
const REVEALED_CLASS = 'nb-content-revealed';
/** Clase en <html>: la intro ya salió por arriba (muestra la barra del pedido). */
const PAST_INTRO_CLASS = 'nb-past-intro';

// --- TEMP DEBUG (iOS): añade ?nbdebug a la URL para ver una línea de
// tiempo del skip en pantalla y en consola. Quitar cuando se cierre el bug.
const NB_DEBUG = typeof window !== 'undefined' && /[?&]nbdebug/.test(window.location.search);
/** ?nointro: sin secuencia (para aislar intro vs. resto de la página). */
const NB_NO_INTRO = typeof window !== 'undefined' && /[?&]nointro/.test(window.location.search);
let nbDebugT0 = 0;
let nbDebugEl: HTMLPreElement | null = null;

/** Detector de bloqueo del hilo principal: huecos entre frames > 100 ms durante 6 s tras el tap. */
function nbWatchMainThread() {
  if (!NB_DEBUG) return;
  const start = performance.now();
  let last = start;
  let worst = 0;
  function tick() {
    const now = performance.now();
    const gap = now - last;
    if (gap > 100) nbMark('MAIN THREAD BLOCKED', { ms: Math.round(gap), scrollY: Math.round(window.scrollY) });
    worst = Math.max(worst, gap);
    last = now;
    if (now - start < 6000) window.requestAnimationFrame(tick);
    else nbMark('watch end', { worstGapMs: Math.round(worst), scrollY: Math.round(window.scrollY) });
  }
  window.requestAnimationFrame(tick);
}
function nbMark(label: string, extra?: Record<string, unknown>) {
  if (!NB_DEBUG) return;
  const t = performance.now();
  if (label === 'tap') nbDebugT0 = t;
  const line = `${String(Math.round(t - nbDebugT0)).padStart(5)}ms ${label}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  console.log('[nb]', line);
  if (!nbDebugEl) {
    nbDebugEl = document.createElement('pre');
    nbDebugEl.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;max-height:45vh;overflow:auto;margin:0;padding:6px 8px;background:rgba(0,0,0,.85);color:#0f0;font:10px/1.35 monospace;z-index:9999;pointer-events:none;white-space:pre-wrap';
    document.body.appendChild(nbDebugEl);
  }
  nbDebugEl.textContent += line + '\n';
  nbDebugEl.scrollTop = nbDebugEl.scrollHeight;
}
// --- /TEMP DEBUG

/** Ancla post-intro: la sección Hero ("Tu antojo empieza aquí"). */
const POST_INTRO_TARGET_ID = 'inicio';

/**
 * Imágenes visibles nada más aterrizar tras el skip en un viewport móvil:
 * el logo del header y el burger del Hero. Nada más (las tarjetas del menú
 * quedan bajo el fold y siguen su lazy-loading normal). Ambas ya se
 * descargan al cargar la página (next/image `priority` → <link rel=preload>),
 * pero se pintan con `decoding="async"`: tras un salto instantáneo Safari
 * las muestra vacías hasta terminar el decode. Por eso se decodifican en el
 * loader y se vuelve a esperar su decode justo antes de saltar.
 */
const POST_INTRO_CRITICAL_IMAGES = '.site-header img, #inicio img';

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

function frameSrc(oneBasedIndex: number) {
  return `/sequence-mobile/frame_${String(oneBasedIndex).padStart(6, '0')}.webp`;
}

function clamp01(n: number) {
  return Math.min(Math.max(n, 0), 1);
}

/** Descarga con reintentos. No decodifica: solo confirma 200 y llena la cache HTTP. */
async function fetchWithRetry(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, { cache: 'force-cache' });
      if (res.ok) return true;
    } catch {
      // reintenta
    }
  }
  return false;
}

/** Ejecuta `work(i)` para i en [0, count) con concurrencia limitada. Devuelve false si alguna falla. */
async function runPool(count: number, concurrency: number, work: (i: number) => Promise<boolean>) {
  let cursor = 0;
  let failed = false;
  async function worker() {
    while (!failed && cursor < count) {
      const i = cursor;
      cursor += 1;
      if (!(await work(i))) failed = true;
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return !failed;
}

/** Resuelve cuando la imagen está cargada Y decodificada. Nunca rechaza. */
function whenImageDecoded(img: HTMLImageElement): Promise<void> {
  const decode = () =>
    typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve();
  if (img.complete) return decode();
  return new Promise<void>((resolve) => {
    img.addEventListener('load', () => decode().then(resolve), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}

function decodePostIntroCriticalImages(): Promise<void> {
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(POST_INTRO_CRITICAL_IMAGES));
  return Promise.all(imgs.map(whenImageDecoded)).then(() => undefined);
}

function frameSize(frame: FrameSource) {
  return 'naturalWidth' in frame
    ? { w: frame.naturalWidth, h: frame.naturalHeight }
    : { w: frame.width, h: frame.height };
}

/** Pinta `frame` en "contain" (nunca recorta el burger ni el logo). Sin frame, no toca el canvas. */
function drawFrame(canvas: HTMLCanvasElement, frame: FrameSource | null) {
  if (!frame) return;
  const { w, h } = frameSize(frame);
  if (!w || !h) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.fillStyle = '#080706';
  ctx.fillRect(0, 0, cw, ch);
  const scale = Math.min(cw / w, ch / h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(frame, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

/** Bitmap del canvas = tamaño CSS real (100 % del sticky en dvh) × DPR (cap 2). */
function sizeCanvasBitmap(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(canvas.clientWidth * dpr);
  const height = Math.round(canvas.clientHeight * dpr);
  if (width === canvas.width && height === canvas.height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}

/** Estilo inline directo, sin transición: refleja la frame al instante. Solo opacity/transform. */
function applyNavbar(frameIndex: number) {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return;
  const span = NAVBAR_END_INDEX - NAVBAR_START_INDEX;
  const p = clamp01((frameIndex - NAVBAR_START_INDEX) / span);
  header.style.opacity = String(p);
  header.style.transform = `translateY(${(1 - p) * -12}px)`;
  header.style.pointerEvents = p >= 0.85 ? 'auto' : 'none';
}

/** El badge "Saltar intro" se desvanece entre las frames 7 y 9. */
function applyBadge(el: HTMLElement | null, frameIndex: number) {
  if (!el) return;
  const opacity = frameIndex <= 7 ? 1 : frameIndex >= 9 ? 0 : 1 - (frameIndex - 7) / 2;
  const hidden = opacity < 0.05;
  el.style.opacity = String(opacity);
  el.style.transform = `translate(-50%, ${(1 - opacity) * -8}px)`;
  el.style.pointerEvents = hidden ? 'none' : 'auto';
  if (hidden) {
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('tabindex', '-1');
  } else {
    el.removeAttribute('aria-hidden');
    el.removeAttribute('tabindex');
  }
}

function revealContent() {
  document.documentElement.classList.add(REVEALED_CLASS);
}

// ---------------------------------------------------------------------------
// Entrada: decide mobile / reduced-motion. Desktop no monta nada.
// ---------------------------------------------------------------------------

type Mode = 'none' | 'sequence' | 'static';

export function MobileFrameSequenceIntro() {
  const [mode, setMode] = useState<Mode>('none');

  useEffect(() => {
    if (/[?&]noglass/.test(window.location.search)) document.documentElement.classList.add('nb-noglass'); // TEMP DEBUG
    const mobile = window.matchMedia(MOBILE_QUERY);
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    function apply() {
      setMode(!mobile.matches ? 'none' : reduced.matches || NB_NO_INTRO ? 'static' : 'sequence');
    }
    apply();
    mobile.addEventListener('change', apply);
    reduced.addEventListener('change', apply);
    return () => {
      mobile.removeEventListener('change', apply);
      reduced.removeEventListener('change', apply);
    };
  }, []);

  if (mode === 'none') return null;
  if (mode === 'static') return <ReducedMotionIntro />;
  return <MobileFrameSequence />;
}

/** prefers-reduced-motion: sin secuencia; contenido, barra y navbar visibles de inmediato. */
function ReducedMotionIntro() {
  useEffect(() => {
    applyNavbar(LAST_INDEX);
    revealContent();
    document.documentElement.classList.add(PAST_INTRO_CLASS);
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// Secuencia
// ---------------------------------------------------------------------------

type Phase = 'loading' | 'failed' | 'ready';

function MobileFrameSequence() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const badgeRef = useRef<HTMLButtonElement | null>(null);

  /** Ventana de frames decodificadas (ver lib/frame-cache.ts). Se crea en el loader. */
  const cacheRef = useRef<FrameCache | null>(null);
  /** Frame objetivo actual (según el scroll) y frame realmente pintada. */
  const targetIndexRef = useRef(0);
  const drawnIndexRef = useRef(-1);
  /** Último índice aplicado a badge/navbar (evita reescribir estilos si no cambia). */
  const appliedIndexRef = useRef(-1);
  /** Último valor aplicado de `nb-past-intro`. */
  const pastIntroRef = useRef<boolean | null>(null);
  /** rAF pendiente para repintar cuando llega una frame que faltaba. */
  const repaintRafRef = useRef(0);
  const lastMissLogRef = useRef(0);

  // --- Contenido post-intro en el flujo desde el montaje ------------------
  // El loader tapa la pantalla; la página se maqueta y pinta 450vh más
  // abajo mientras se descargan las frames. El destino del skip queda
  // listo antes de que el botón exista.

  useEffect(() => {
    revealContent();
    nbMark('mount: content revealed');
  }, []);

  // --- Render: scroll real → progress → frame → pintar -----------------

  const render = useCallback(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const canvas = canvasRef.current;
    if (!section || !sticky || !canvas) return;

    const rect = section.getBoundingClientRect();
    const pastIntro = rect.bottom <= 0;

    // Recorrido = altura del spacer (vh) − altura del sticky (dvh, la que
    // el CSS le da ahora mismo): el mismo modelo que usa el navegador para
    // soltar el sticky, sin leer innerHeight ni visualViewport.
    let progress = 1;
    if (!pastIntro) {
      const scrollable = section.offsetHeight - sticky.offsetHeight;
      progress = scrollable > 0 ? clamp01(-rect.top / scrollable) : 1;
    }
    const frameIndex = Math.round(progress * LAST_INDEX);
    targetIndexRef.current = frameIndex;

    // La ventana decodificada sigue al objetivo (latest-position-wins: un
    // fling reprioriza la cola, no reproduce frames intermedias).
    const cache = cacheRef.current;
    cache?.setTarget(frameIndex);

    // Con el canvas fuera de pantalla no hay nada que pintar. Dentro: la
    // frame exacta si está decodificada; si no, la decodificada más
    // cercana (nunca vacío/negro), y se sustituye cuando llega la exacta.
    if (!pastIntro && cache) {
      const best = cache.nearest(frameIndex);
      if (best && best.index !== drawnIndexRef.current) {
        drawFrame(canvas, best.frame);
        drawnIndexRef.current = best.index;
      }
      if (NB_DEBUG && (!best || best.index !== frameIndex)) {
        const now = performance.now();
        if (now - lastMissLogRef.current > 250) {
          lastMissLogRef.current = now;
          nbMark('frame miss', { want: frameIndex, drawn: best?.index ?? null, ...cache.stats() });
        }
      }
    }

    if (appliedIndexRef.current !== frameIndex) {
      appliedIndexRef.current = frameIndex;
      applyBadge(badgeRef.current, frameIndex);
      applyNavbar(frameIndex);
    }

    if (pastIntroRef.current !== pastIntro) {
      pastIntroRef.current = pastIntro;
      document.documentElement.classList.toggle(PAST_INTRO_CLASS, pastIntro);
      nbMark(pastIntro ? 'render: past intro' : 'render: inside intro', { scrollY: Math.round(window.scrollY), frameIndex });
    }
  }, []);

  // --- Bitmap del canvas: sigue al tamaño CSS real (100dvh) ----------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (sizeCanvasBitmap(canvas)) {
        drawnIndexRef.current = -1; // cambiar width/height borra el canvas
        render();
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [render]);

  /** Una frame que faltaba acaba de llegar: si es la que toca, repintar en el próximo frame. */
  const onFrameReady = useCallback(
    (index: number) => {
      if (index !== targetIndexRef.current || drawnIndexRef.current === index) return;
      if (repaintRafRef.current) return;
      repaintRafRef.current = window.requestAnimationFrame(() => {
        repaintRafRef.current = 0;
        render();
      });
    },
    [render],
  );

  // --- Loader: frames + fuentes + destino del skip -----------------------

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setLoadProgress(0);

    // Cache decodificada de esta carga. Se cierra entera al desmontar o al
    // reintentar (cleanup del efecto).
    const cache = new FrameCache({
      total: TOTAL_FRAMES,
      src: (i) => frameSrc(i + 1),
      behind: WINDOW_BEHIND,
      ahead: WINDOW_AHEAD,
      concurrency: DECODE_CONCURRENCY,
      onFrameReady,
    });
    cacheRef.current = cache;
    drawnIndexRef.current = -1;

    (async () => {
      // 1) Red: las 193 a la cache HTTP. Sin decodificar.
      let fetched = 0;
      const fetchedAll = await runPool(TOTAL_FRAMES, FETCH_CONCURRENCY, async (i) => {
        const ok = await fetchWithRetry(frameSrc(i + 1));
        if (cancelled) return false;
        if (ok) {
          fetched += 1;
          setLoadProgress(Math.round((fetched / TOTAL_FRAMES) * FETCH_PROGRESS_SHARE * 100));
        }
        return ok;
      });
      if (cancelled) return;
      if (!fetchedAll) {
        setPhase('failed');
        return;
      }
      nbMark('loader: network cache ready');

      // 2) Decodificar solo la primera ventana (objetivo 0 + 14 delante).
      cache.setTarget(0);
      await cache.whenIdle();
      if (cancelled) return;
      if (!cache.get(0)) {
        setPhase('failed'); // sin primera frame no hay intro que mostrar
        return;
      }
      setLoadProgress(Math.round(FETCH_PROGRESS_SHARE * 100 + 10));
      nbMark('loader: first window decoded', cache.stats());

      // 3) Fuentes (loader y hero) + imágenes críticas del destino del skip:
      // el header y el hero ya están en el DOM y sus <img> son eager, así
      // que se pueden decodificar ahora. Condiciones reales, sin timeouts.
      await Promise.all([
        'fonts' in document ? document.fonts.ready.then(() => undefined, () => undefined) : Promise.resolve(),
        decodePostIntroCriticalImages().then(() => nbMark('loader: destination images decoded')),
      ]);
      if (cancelled) return;
      setLoadProgress(100);
      nbMark('loader: ready');
      setPhase('ready');
    })();

    return () => {
      cancelled = true;
      if (repaintRafRef.current) {
        window.cancelAnimationFrame(repaintRafRef.current);
        repaintRafRef.current = 0;
      }
      cache.dispose(); // cierra todos los ImageBitmap, vacía la cola
      if (cacheRef.current === cache) cacheRef.current = null;
    };
  }, [retryTick, onFrameReady]);

  const handleRetryLoad = useCallback(() => {
    setRetryTick((n) => n + 1);
  }, []);

  // --- Scroll bloqueado mientras el loader está activo --------------------

  useEffect(() => {
    if (phase === 'ready') return;
    lockScroll();
    return unlockScroll;
  }, [phase]);

  // --- Restauración de scroll del navegador: desactivada en mobile --------
  // Con 'auto', al recargar Safari reaplica la posición guardada en cada
  // layout hasta que el usuario toca; con la intro delante eso puede pisar
  // el aterrizaje (natural o del skip). La página se abre siempre en la
  // intro; no hay posición que restaurar.

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return;
    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  // --- Render loop: un listener de scroll → un rAF → render ---------------

  useEffect(() => {
    if (phase !== 'ready') return;
    let rafId = 0;
    function onScroll() {
      if (NB_DEBUG && nbDebugT0 && performance.now() - nbDebugT0 < 4000) {
        nbMark('scroll event', { scrollY: Math.round(window.scrollY) });
      }
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        render();
      });
    }
    render();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [phase, render]);

  // --- Saltar intro: navegar, nada más -----------------------------------

  /**
   * Síncrono y sin esperas: el destino ya está maquetado (reveal al montar)
   * y sus imágenes decodificadas (loader).
   *  1. quitar el foco del botón (iOS "recentra" el scroll sobre un botón
   *     enfocado cuya posición cambia bajo el dedo);
   *  2. `scrollToSection('inicio')`: el mismo helper que usan todos los
   *     enlaces internos del sitio (instantáneo en mobile, sin hash);
   *  3. `render()`: navbar/badge/barra reflejan la nueva posición en el
   *     mismo tick, sin esperar al evento de scroll.
   */
  const handleSkip = useCallback(() => {
    nbMark('tap', { scrollY: Math.round(window.scrollY), ...(cacheRef.current?.stats() ?? {}) });
    (document.activeElement as HTMLElement | null)?.blur?.();
    const target = document.getElementById(POST_INTRO_TARGET_ID);
    nbMark('target', {
      top: target ? Math.round(target.getBoundingClientRect().top) : null,
      imgsComplete: Array.from(document.querySelectorAll<HTMLImageElement>(POST_INTRO_CRITICAL_IMAGES)).map((i) => i.complete),
    });
    scrollToSection(POST_INTRO_TARGET_ID);
    nbMark('after scroll', { scrollY: Math.round(window.scrollY) });
    render();
    if (NB_DEBUG) {
      window.requestAnimationFrame(() => nbMark('next rAF', { scrollY: Math.round(window.scrollY) }));
      nbWatchMainThread();
    }
  }, [render]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  const ready = phase === 'ready';

  return (
    <div className="nb-intro-overlay">
      <div ref={sectionRef} className="nb-intro-scroll" style={{ height: `${SCROLL_VH}vh` }}>
        <div ref={stickyRef} className="nb-intro-sticky">
          <canvas ref={canvasRef} className="nb-intro-canvas" />

          <div
            className={`nb-intro-loader${ready ? ' nb-intro-loader--hidden' : ''}`}
            role="status"
            aria-live="polite"
            aria-hidden={ready ? 'true' : undefined}
          >
            <img src="/nata-burgers-logo.png" alt="Nata Burger's" />
            {phase === 'failed' ? (
              <>
                <p className="nb-intro-loader-text">No se pudo cargar la introducción.</p>
                <button type="button" className="nb-intro-retry" onClick={handleRetryLoad}>
                  Reintentar
                </button>
              </>
            ) : (
              <>
                <div className="nb-intro-loader-bar">
                  <div className="nb-intro-loader-bar-fill" style={{ width: `${loadProgress}%` }} />
                </div>
                <p className="nb-intro-loader-text">Preparando tu experiencia · {loadProgress}%</p>
              </>
            )}
          </div>

          {ready ? (
            <>
              <button
                ref={badgeRef}
                type="button"
                className="nb-intro-skip"
                onClick={handleSkip}
                aria-label="Saltar la introducción"
              >
                Saltar intro
                <svg
                  className="nb-intro-skip-arrow"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 4.5L6 8l3.5-3.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <span className="nb-intro-swipe-hint" aria-hidden="true">
                Desliza
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 4l3 3 3-3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
