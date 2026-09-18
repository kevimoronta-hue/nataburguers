/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 *  ANCLAJE — 100 % CSS: un spacer de 450vh con un hijo sticky de 100dvh.
 *    `vh` (viewport grande, constante) fija la longitud del recorrido y
 *    la posición del contenido que sigue; `dvh` absorbe la barra dinámica
 *    de Safari. El único JS de "viewport" es dimensionar el bitmap del
 *    canvas al tamaño real que le da el CSS (ResizeObserver).
 *
 *  CONTENIDO POST-INTRO — main/footer/cartbar están en `display:none`
 *    solo hasta la PRIMERA vez que se completa la intro. Se revelan una
 *    vez (clase one-way en <html>) y nunca se vuelven a ocultar: el layout
 *    completo de la página ocurre exactamente una vez, jamás en un rewind.
 *
 *  SALTAR INTRO — navega, nada más: revela (si hace falta), espera a que
 *    las imágenes críticas del destino estén decodificadas (promesa real),
 *    y hace un scrollTo directo al ancla del Hero. Idempotente: cada clic
 *    ejecuta exactamente lo mismo, sea cual sea la frame o el historial.
 *
 *  LOADER — antes de soltar la experiencia: 193 frames descargadas y
 *    decodificadas, fuentes listas, imágenes críticas del destino
 *    decodificadas. Cero red durante el scroll; skip a destino caliente.
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const TOTAL_FRAMES = 193;
const LAST_INDEX = TOTAL_FRAMES - 1;
const SCROLL_VH = 450;

/** Progreso a partir del cual se revela (una sola vez) el contenido post-intro. */
const CONTENT_REVEAL_ON = 0.985;

/** La navbar aparece sobre las últimas frames (168 → 184, 1-based). */
const NAVBAR_START_INDEX = 167;
const NAVBAR_END_INDEX = 183;

const FETCH_CONCURRENCY = 6;
const DECODE_CONCURRENCY = 6;
const MAX_RETRIES = 3;
/** Reparto del progreso mostrado: el fetch es la parte lenta, el decode es CPU. */
const FETCH_PROGRESS_SHARE = 0.6;

/** Clase one-way en <html>: el contenido post-intro ya puede mostrarse. */
const REVEALED_CLASS = 'nb-content-revealed';

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

/** Decodifica una frame ya presente en la cache HTTP. */
function decodeFrame(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (typeof img.decode === 'function') img.decode().then(() => resolve(img), () => resolve(null));
      else resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
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

function drawFrame(canvas: HTMLCanvasElement, img: HTMLImageElement | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.fillStyle = '#080706';
  ctx.fillRect(0, 0, cw, ch);
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  // "contain": nunca recorta el burger ni el logo.
  const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
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
    const mobile = window.matchMedia(MOBILE_QUERY);
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    function apply() {
      setMode(!mobile.matches ? 'none' : reduced.matches ? 'static' : 'sequence');
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

/** prefers-reduced-motion: sin secuencia; contenido y navbar visibles de inmediato. */
function ReducedMotionIntro() {
  useEffect(() => {
    applyNavbar(LAST_INDEX);
    revealContent();
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

  /** Las 193 frames decodificadas, en orden. Única estructura del motor. */
  const framesRef = useRef<Array<HTMLImageElement | null>>(new Array(TOTAL_FRAMES).fill(null));
  /** Último índice aplicado a badge/navbar (evita reescribir estilos si no cambia). */
  const appliedIndexRef = useRef(-1);
  /** Un salto en curso: el render loop cede el control hasta que termina. */
  const skipInFlightRef = useRef(false);

  // --- Render: scroll real → progress → frame → pintar -----------------

  const render = useCallback(() => {
    if (skipInFlightRef.current) return;
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

    // Con el canvas fuera de pantalla no hay nada que pintar. Dentro, se
    // pinta siempre la frame de la posición actual (latest-frame-wins).
    if (!pastIntro) drawFrame(canvas, framesRef.current[frameIndex]);

    if (appliedIndexRef.current !== frameIndex) {
      appliedIndexRef.current = frameIndex;
      applyBadge(badgeRef.current, frameIndex);
      applyNavbar(frameIndex);
    }

    if (progress >= CONTENT_REVEAL_ON) revealContent();
  }, []);

  // --- Bitmap del canvas: sigue al tamaño CSS real (100dvh) ----------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (sizeCanvasBitmap(canvas)) render(); // cambiar width/height borra el canvas
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [render]);

  // --- Loader: frames + fuentes + destino del skip -----------------------

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setLoadProgress(0);

    (async () => {
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

      let decoded = 0;
      const decodedAll = await runPool(TOTAL_FRAMES, DECODE_CONCURRENCY, async (i) => {
        const img = await decodeFrame(frameSrc(i + 1));
        if (cancelled) return false;
        if (!img) return false;
        framesRef.current[i] = img;
        decoded += 1;
        const pct = FETCH_PROGRESS_SHARE + (decoded / TOTAL_FRAMES) * (1 - FETCH_PROGRESS_SHARE);
        setLoadProgress(Math.round(pct * 100));
        return true;
      });
      if (cancelled) return;
      if (!decodedAll) {
        setPhase('failed');
        return;
      }

      // Fuentes (loader y hero) + imágenes críticas del destino del skip:
      // el header y el hero ya están en el DOM (display:none) y sus <img>
      // son eager, así que se pueden decodificar ahora. Condiciones reales,
      // sin timeouts.
      await Promise.all([
        'fonts' in document ? document.fonts.ready.then(() => undefined, () => undefined) : Promise.resolve(),
        decodePostIntroCriticalImages(),
      ]);
      if (cancelled) return;
      setPhase('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const handleRetryLoad = useCallback(() => {
    framesRef.current = new Array(TOTAL_FRAMES).fill(null);
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

  // --- Limpieza al desmontar ---------------------------------------------

  useEffect(() => {
    return () => {
      framesRef.current = new Array(TOTAL_FRAMES).fill(null);
    };
  }, []);

  // --- Saltar intro: navegar, nada más -----------------------------------

  /**
   *  1. candado (reentrada) + quitar el foco del botón (iOS "recentra" el
   *     scroll sobre un botón enfocado cuya posición cambia);
   *  2. revelar el contenido (no-op si ya está revelado);
   *  3. siguiente frame: el layout del contenido revelado ya está asentado
   *     y el ancla tiene su posición definitiva;
   *  4. esperar a que las imágenes críticas del destino estén decodificadas
   *     (promesa real; instantánea si siguen en memoria);
   *  5. `scrollToSection('inicio')`: el mismo helper que usan todos los
   *     enlaces internos del sitio (instantáneo en mobile, sin hash);
   *  6. soltar el candado y dejar que `render()` refleje la nueva posición.
   */
  const handleSkip = useCallback(() => {
    if (skipInFlightRef.current) return;
    skipInFlightRef.current = true;
    (document.activeElement as HTMLElement | null)?.blur?.();

    revealContent();

    window.requestAnimationFrame(() => {
      decodePostIntroCriticalImages()
        .then(() => {
          scrollToSection(POST_INTRO_TARGET_ID);
        })
        .finally(() => {
          skipInFlightRef.current = false;
          render();
        });
    });
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
