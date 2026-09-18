/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Intro de secuencia de frames — solo mobile (<=767px). React desmonta
 * MobileIntroActive al cruzar a desktop (limpia listeners/rAF solo).
 * El parpadeo inicial se evita con un @media puro en globals.css, sin
 * clase en <html>: nada que React tenga que reconciliar al hidratar.
 *
 * Carga: /sequence-mobile/*.webp (900×1600, ~62KB/frame, ~12MB totales),
 * no los .jpg originales de /sequence/ (40MB, 1080×1920) — ver README de
 * la auditoría en el reporte de esta tarea.
 */

const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function MobileFrameSequenceIntro() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    function apply() {
      setIsMobile(mql.matches);
    }
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);

  if (!isMobile) return null;

  return <MobileIntroActive />;
}

const TOTAL_FRAMES = 193;
const LAST_INDEX = TOTAL_FRAMES - 1;
const SCROLL_VH = 450;
// Revela el contenido (main/footer/cartbar) — sin relación con la navbar.
const CONTENT_REVEAL_ON = 0.985;
const CONTENT_REVEAL_OFF = 0.965;
// Frame 168 → 184 (1-based, tal como las pidió el brief) en índice 0-based.
const NAVBAR_START_INDEX = 167;
const NAVBAR_END_INDEX = 183;

// --- Carga y memoria ---
const FETCH_CONCURRENCY = 5;
const MAX_RETRIES = 3;
const PRIORITY_DECODE_COUNT = 10; // decodificadas de entrada: el scroll arranca fluido desde el frame 1
const DECODE_WINDOW_BEFORE = 8;
const DECODE_WINDOW_AFTER = 15;
const FONTS_READY_TIMEOUT_MS = 3000;

function frameSrc(oneBasedIndex: number) {
  return `/sequence-mobile/frame_${String(oneBasedIndex).padStart(6, '0')}.webp`;
}

/** Opacidad/transform/interactividad de la navbar según el frame actual (0-based). */
function navbarVisual(frameIndex: number) {
  const span = NAVBAR_END_INDEX - NAVBAR_START_INDEX;
  const progress = Math.min(Math.max((frameIndex - NAVBAR_START_INDEX) / span, 0), 1);
  return {
    opacity: progress,
    translateY: (1 - progress) * -12,
    blur: (1 - progress) * 2,
    interactive: progress >= 0.85,
  };
}

/** Opacidad/translación del badge según el frame actual (0-based). */
function badgeVisual(frameIndex: number) {
  if (frameIndex <= 7) return { opacity: 1, hidden: false };
  if (frameIndex >= 9) return { opacity: 0, hidden: true };
  const t = frameIndex - 7; // 0..2 → interpola entre frame 8 y frame 10
  const opacity = 1 - t / 2;
  return { opacity, hidden: opacity < 0.05 };
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  img: CanvasImageSource | null,
  naturalWidth: number,
  naturalHeight: number,
) {
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.fillStyle = '#080706';
  ctx.fillRect(0, 0, cw, ch);
  if (!img || !naturalWidth || !naturalHeight) return;
  // "contain": nunca recorta el burger ni el logo, respeta la composición.
  const scale = Math.min(cw / naturalWidth, ch / naturalHeight);
  const dw = naturalWidth * scale;
  const dh = naturalHeight * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Descarga con reintentos (hasta MAX_RETRIES). No decodifica: solo confirma 200 y llena la cache HTTP. */
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

/** Decodifica una imagen ya presente en la cache HTTP (rápido, sin red real). */
function decodeImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const finish = () => resolve(img);
      if (typeof img.decode === 'function') {
        img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function MobileIntroActive() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reducedMotionReady, setReducedMotionReady] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  // --- Loader bloqueante ---
  const [isExperienceReady, setIsExperienceReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const badgeRef = useRef<HTMLButtonElement | null>(null);

  // Descargado (cache HTTP) vs decodificado (bitmap en memoria) — nunca lo mismo.
  const fetchedSetRef = useRef<Set<number>>(new Set());
  const decodedMapRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const decodingInFlightRef = useRef<Set<number>>(new Set());
  // Única referencia persistente para el fallback de dibujo: nunca se
  // expulsa por la ventana deslizante, así siempre hay algo que pintar.
  const lastGoodImageRef = useRef<HTMLImageElement | null>(null);
  const lastGoodIndexRef = useRef(0);

  const skippingRef = useRef(false);
  const doneRef = useRef(false);

  // Checklist de "experiencia lista" — isExperienceReady solo se activa
  // cuando las seis condiciones son verdaderas, nunca por un timer.
  const readinessRef = useRef({
    allFramesFetched: false,
    initialFramesDecoded: false,
    logoReady: false,
    fontsReady: false,
    canvasReady: false,
    appHydrated: false,
  });

  const checkReady = useCallback(() => {
    const r = readinessRef.current;
    const ready =
      r.allFramesFetched &&
      r.initialFramesDecoded &&
      r.logoReady &&
      r.fontsReady &&
      r.canvasReady &&
      r.appHydrated;
    if (ready) setIsExperienceReady(true);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    function apply() {
      setReducedMotion(mql.matches);
      setReducedMotionReady(true);
    }
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, []);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, []);

  const redrawCurrent = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const img = decodedMapRef.current.get(lastGoodIndexRef.current) ?? lastGoodImageRef.current;
    drawFrame(ctx, canvas, img, img?.naturalWidth ?? 0, img?.naturalHeight ?? 0);
  }, [getCtx]);

  /** Descarta del mapa lo que quede lejos del frame activo y decodifica lo que falte dentro de la ventana. */
  const ensureDecodeWindow = useCallback((centerIndex: number) => {
    const from = Math.max(0, centerIndex - DECODE_WINDOW_BEFORE);
    const to = Math.min(LAST_INDEX, centerIndex + DECODE_WINDOW_AFTER);

    for (const key of Array.from(decodedMapRef.current.keys())) {
      if (key < from || key > to) decodedMapRef.current.delete(key);
    }

    for (let i = from; i <= to; i += 1) {
      if (decodedMapRef.current.has(i) || decodingInFlightRef.current.has(i)) continue;
      if (!fetchedSetRef.current.has(i)) continue;
      decodingInFlightRef.current.add(i);
      decodeImage(frameSrc(i + 1)).then((img) => {
        decodingInFlightRef.current.delete(i);
        if (img) decodedMapRef.current.set(i, img);
      });
    }
  }, []);

  // --- Precarga: appHydrated, logo, fuentes, canvas ---
  useEffect(() => {
    readinessRef.current.appHydrated = true;
    checkReady();
  }, [checkReady]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      readinessRef.current.logoReady = true;
      checkReady();
    };
    img.onerror = () => {
      // No bloquear indefinidamente por un logo que nunca llegará.
      readinessRef.current.logoReady = true;
      checkReady();
    };
    img.src = '/nata-burgers-logo.png';
  }, [checkReady]);

  useEffect(() => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      readinessRef.current.fontsReady = true;
      checkReady();
    };
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(settle).catch(settle);
    } else {
      settle();
    }
    const timeout = window.setTimeout(settle, FONTS_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [checkReady]);

  useEffect(() => {
    if (reducedMotion) return;
    resizeCanvas();
    readinessRef.current.canvasReady = true;
    checkReady();
  }, [reducedMotion, resizeCanvas, checkReady]);

  // --- Descarga con concurrencia limitada + decodificación prioritaria ---
  useEffect(() => {
    if (!reducedMotionReady || reducedMotion) return;
    let cancelled = false;
    setLoadFailed(false);

    (async () => {
      // Frame 1 primero, en solitario: es lo primero que se ve tras el loader.
      const firstOk = await fetchWithRetry(frameSrc(1));
      if (cancelled) return;
      if (!firstOk) {
        setLoadFailed(true);
        return;
      }
      fetchedSetRef.current.add(0);
      setLoadProgress(Math.round((1 / TOTAL_FRAMES) * 100));
      const firstImg = await decodeImage(frameSrc(1));
      if (cancelled) return;
      if (firstImg) {
        decodedMapRef.current.set(0, firstImg);
        lastGoodImageRef.current = firstImg;
        lastGoodIndexRef.current = 0;
        setFirstFrameReady(true);
        redrawCurrent();
      }

      // Resto de la cola: concurrencia limitada, prioridad a las primeras.
      const remaining = Array.from({ length: TOTAL_FRAMES - 1 }, (_, i) => i + 1);
      let cursor = 0;
      let failedAny = false;
      let fetchedCount = 1;

      async function worker() {
        while (!cancelled && cursor < remaining.length && !failedAny) {
          const idx = remaining[cursor];
          cursor += 1;
          const ok = await fetchWithRetry(frameSrc(idx + 1));
          if (cancelled) return;
          if (!ok) {
            failedAny = true;
            setLoadFailed(true);
            return;
          }
          fetchedSetRef.current.add(idx);
          fetchedCount += 1;
          setLoadProgress(Math.round((fetchedCount / TOTAL_FRAMES) * 100));
          if (idx < PRIORITY_DECODE_COUNT) {
            const img = await decodeImage(frameSrc(idx + 1));
            if (!cancelled && img) decodedMapRef.current.set(idx, img);
          }
        }
      }

      await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));
      if (cancelled || failedAny) return;

      readinessRef.current.allFramesFetched = true;
      readinessRef.current.initialFramesDecoded = true;
      checkReady();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotionReady, reducedMotion, retryTick]);

  const handleRetryLoad = useCallback(() => {
    fetchedSetRef.current.clear();
    decodedMapRef.current.clear();
    lastGoodImageRef.current = null;
    lastGoodIndexRef.current = 0;
    setFirstFrameReady(false);
    setLoadProgress(0);
    setLoadFailed(false);
    setRetryTick((n) => n + 1);
  }, []);

  // Bloquea el scroll de la página mientras el loader está activo: nada
  // debe avanzar, ni el badge ni la navbar deben aparecer todavía.
  useEffect(() => {
    if (reducedMotion) return;
    if (isExperienceReady) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevWidth = body.style.width;
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    return () => {
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.width = prevWidth;
    };
  }, [reducedMotion, isExperienceReady]);

  /** Revela main/footer/cartbar. La navbar YA NO depende de esto. */
  const setContentRevealed = useCallback((done: boolean) => {
    if (doneRef.current === done) return;
    doneRef.current = done;
    document.documentElement.classList.toggle('nb-intro-done', done);
  }, []);

  /**
   * Estilo inline directo, sin transición CSS: la navbar debe reflejar el
   * frame actual al instante, igual que el canvas. Cualquier transición
   * temporal aquí reintroduciría el "sigue moviéndose solo" que el fix
   * de scroll-only busca eliminar.
   */
  const updateNavbar = useCallback((frameIndex: number) => {
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!header) return;
    const { opacity, translateY, blur, interactive } = navbarVisual(frameIndex);
    header.style.opacity = String(opacity);
    header.style.transform = `translateY(${translateY}px)`;
    header.style.filter = blur > 0.01 ? `blur(${blur}px)` : 'none';
    header.style.pointerEvents = interactive ? 'auto' : 'none';
  }, []);

  const updateBadge = useCallback((frameIndex: number) => {
    const el = badgeRef.current;
    if (!el) return;
    const { opacity, hidden } = badgeVisual(frameIndex);
    el.style.opacity = String(opacity);
    el.style.transform = `translate(-50%, ${(1 - opacity) * -8}px)`;
    el.style.pointerEvents = hidden ? 'none' : 'auto';
    if (hidden) {
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('tabIndex', '-1');
    } else {
      el.removeAttribute('aria-hidden');
      el.removeAttribute('tabIndex');
    }
  }, []);

  // Bucle de scroll → progreso → frame. Nunca secuestra el gesto: solo lee
  // la posición real del scroll dentro de la sección. No se activa hasta
  // que la experiencia está lista: antes de eso no hay nada que leer.
  useEffect(() => {
    if (!reducedMotionReady || reducedMotion || !isExperienceReady) return;

    const canvas = canvasRef.current;
    const maybeCtx = getCtx();
    if (!canvas || !maybeCtx) return;
    const ctx = maybeCtx;

    let ticking = false;
    let rafId = 0;

    function computeProgress() {
      const section = sectionRef.current;
      if (!section) return 0;
      const rect = section.getBoundingClientRect();
      const scrollableRange = section.offsetHeight - window.innerHeight;
      if (scrollableRange <= 0) return 1;
      const scrolled = -rect.top;
      return Math.min(Math.max(scrolled / scrollableRange, 0), 1);
    }

    function tick() {
      ticking = false;
      if (skippingRef.current) return;

      const section = sectionRef.current;
      if (section && section.getBoundingClientRect().bottom <= 0) {
        // El usuario ya salió de la zona de la intro por scroll normal:
        // evita redibujar un canvas que ya no es visible. La navbar ya
        // quedó en su estado final antes de llegar aquí; no se toca de
        // nuevo (nunca se apaga y se re-enciende una segunda vez).
        setContentRevealed(true);
        return;
      }

      const progress = computeProgress();
      const frameIndex = Math.min(Math.max(Math.round(progress * LAST_INDEX), 0), LAST_INDEX);

      ensureDecodeWindow(frameIndex);

      const img = decodedMapRef.current.get(frameIndex);
      if (img) {
        lastGoodIndexRef.current = frameIndex;
        lastGoodImageRef.current = img;
        drawFrame(ctx, canvas as HTMLCanvasElement, img, img.naturalWidth, img.naturalHeight);
      } else {
        const fallback = lastGoodImageRef.current;
        drawFrame(
          ctx,
          canvas as HTMLCanvasElement,
          fallback,
          fallback?.naturalWidth ?? 0,
          fallback?.naturalHeight ?? 0,
        );
      }

      updateBadge(frameIndex);
      updateNavbar(frameIndex);

      if (progress >= CONTENT_REVEAL_ON) setContentRevealed(true);
      else if (progress < CONTENT_REVEAL_OFF) setContentRevealed(false);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      rafId = window.requestAnimationFrame(tick);
    }

    tick();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [
    reducedMotionReady,
    reducedMotion,
    isExperienceReady,
    getCtx,
    updateBadge,
    updateNavbar,
    setContentRevealed,
    ensureDecodeWindow,
  ]);

  // Resize / cambio de orientación: recalcula el canvas sin estirar la imagen.
  useEffect(() => {
    if (!reducedMotionReady || reducedMotion) return;
    let rafId = 0;
    function onResize() {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        resizeCanvas();
        redrawCurrent();
      });
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [reducedMotionReady, reducedMotion, resizeCanvas, redrawCurrent]);

  // Modo prefers-reduced-motion: sin scroll forzado, acceso inmediato.
  useEffect(() => {
    if (!reducedMotionReady || !reducedMotion) return;
    let cancelled = false;
    decodeImage(frameSrc(1)).then((img) => {
      if (cancelled || !img) return;
      setFirstFrameReady(true);
    });
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      updateNavbar(LAST_INDEX);
      setContentRevealed(true);
    }, 550);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reducedMotionReady, reducedMotion, updateNavbar, setContentRevealed]);

  const handleSkip = useCallback(() => {
    if (skippingRef.current || doneRef.current) return;
    skippingRef.current = true;

    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      const last = decodedMapRef.current.get(LAST_INDEX) ?? lastGoodImageRef.current;
      drawFrame(ctx, canvas, last, last?.naturalWidth ?? 0, last?.naturalHeight ?? 0);
      lastGoodIndexRef.current = LAST_INDEX;
      if (last) lastGoodImageRef.current = last;
      updateBadge(LAST_INDEX);
    }
    // Estado final mostrado ya: la navbar no repite su propia animación de
    // entrada, y el contenido se revela antes de mover el scroll (si no,
    // main sigue en display:none y scrollIntoView no tiene nada que medir).
    updateNavbar(LAST_INDEX);
    setContentRevealed(true);

    window.requestAnimationFrame(() => {
      const target = document.getElementById('main-content');
      if (target) {
        // scrollIntoView({behavior:'auto'}) hereda `scroll-behavior` del
        // <html>, que aquí es `smooth` — forzarlo a 'auto' evita que el
        // salto recorra visualmente la intro en vez de ser instantáneo.
        const html = document.documentElement;
        const prevScrollBehavior = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
        html.style.scrollBehavior = prevScrollBehavior;
      }
      window.requestAnimationFrame(() => {
        skippingRef.current = false;
      });
    });
  }, [getCtx, setContentRevealed, updateBadge, updateNavbar]);

  if (reducedMotionReady && reducedMotion) {
    return (
      <div className="nb-intro-overlay nb-intro-overlay--static" aria-hidden="true">
        <div className="nb-intro-static-frame">
          {firstFrameReady ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frameSrc(1)} alt="" />
          ) : (
            <div className="nb-intro-loader">
              <img src="/nata-burgers-logo.png" alt="Nata Burger's" />
              <div className="nb-intro-loader-track" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="nb-intro-overlay">
      <div ref={sectionRef} className="nb-intro-scroll" style={{ height: `${SCROLL_VH}vh` }}>
        <div className="nb-intro-sticky">
          <canvas ref={canvasRef} className="nb-intro-canvas" />

          <div
            className={`nb-intro-loader${isExperienceReady ? ' nb-intro-loader--hidden' : ''}`}
            role="status"
            aria-live="polite"
            aria-hidden={isExperienceReady ? 'true' : undefined}
          >
            <img src="/nata-burgers-logo.png" alt="Nata Burger's" />
            {loadFailed ? (
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

          {isExperienceReady ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
