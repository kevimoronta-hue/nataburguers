/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Intro de secuencia de frames — solo mobile (<=767px). React desmonta
 * MobileIntroActive al cruzar a desktop (limpia listeners/rAF solo).
 * El parpadeo inicial se evita con un @media puro en globals.css, sin
 * clase en <html>: nada que React tenga que reconciliar al hidratar.
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

function frameSrc(oneBasedIndex: number) {
  return `/sequence/frame_${String(oneBasedIndex).padStart(6, '0')}.jpg`;
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

function MobileIntroActive() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reducedMotionReady, setReducedMotionReady] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const badgeRef = useRef<HTMLButtonElement | null>(null);

  const framesRef = useRef<Array<HTMLImageElement | null>>(
    Array.from({ length: TOTAL_FRAMES }, () => null),
  );
  const lastGoodIndexRef = useRef(0);
  const skippingRef = useRef(false);
  const doneRef = useRef(false);

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

  const loadFrame = useCallback((zeroBasedIndex: number): Promise<HTMLImageElement | null> => {
    const existing = framesRef.current[zeroBasedIndex];
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const finish = () => {
          framesRef.current[zeroBasedIndex] = img;
          resolve(img);
        };
        if (typeof img.decode === 'function') {
          img.decode().then(finish).catch(finish);
        } else {
          finish();
        }
      };
      img.onerror = () => resolve(null);
      img.src = frameSrc(zeroBasedIndex + 1);
    });
  }, []);

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
    const img = framesRef.current[lastGoodIndexRef.current];
    drawFrame(ctx, canvas, img, img?.naturalWidth ?? 0, img?.naturalHeight ?? 0);
  }, [getCtx]);

  // Progressive loading — solo cuando la intro con movimiento está activa.
  useEffect(() => {
    if (!reducedMotionReady || reducedMotion) return;
    let cancelled = false;

    (async () => {
      const first = await loadFrame(0);
      if (cancelled) return;
      lastGoodIndexRef.current = 0;
      if (first) {
        setFirstFrameReady(true);
        resizeCanvas();
        redrawCurrent();
      }

      const CONCURRENCY = 4;
      let next = 1;
      async function worker() {
        while (!cancelled && next < TOTAL_FRAMES) {
          const idx = next;
          next += 1;
          await loadFrame(idx);
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    })();

    return () => {
      cancelled = true;
    };
  }, [reducedMotionReady, reducedMotion, loadFrame, resizeCanvas, redrawCurrent]);

  // Bucle de scroll → progreso → frame. Nunca secuestra el gesto: solo lee
  // la posición real del scroll dentro de la sección.
  useEffect(() => {
    if (!reducedMotionReady || reducedMotion) return;

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

      const img = framesRef.current[frameIndex];
      if (img) {
        lastGoodIndexRef.current = frameIndex;
        drawFrame(ctx, canvas as HTMLCanvasElement, img, img.naturalWidth, img.naturalHeight);
      } else {
        const fallback = framesRef.current[lastGoodIndexRef.current];
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
  }, [reducedMotionReady, reducedMotion, getCtx, updateBadge, updateNavbar, setContentRevealed]);

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
    resizeCanvas();
    redrawCurrent();
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
    loadFrame(0).then(() => {
      if (cancelled) return;
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
  }, [reducedMotionReady, reducedMotion, loadFrame, updateNavbar, setContentRevealed]);

  const handleSkip = useCallback(() => {
    if (skippingRef.current || doneRef.current) return;
    skippingRef.current = true;

    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      const last = framesRef.current[LAST_INDEX] ?? framesRef.current[lastGoodIndexRef.current];
      drawFrame(ctx, canvas, last, last?.naturalWidth ?? 0, last?.naturalHeight ?? 0);
      lastGoodIndexRef.current = LAST_INDEX;
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

          {!firstFrameReady ? (
            <div className="nb-intro-loader">
              <img src="/nata-burgers-logo.png" alt="Nata Burger's" />
              <div className="nb-intro-loader-track" />
            </div>
          ) : null}

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
        </div>
      </div>
    </div>
  );
}
