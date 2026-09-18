/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Secuencia de frames pilotada por scroll — EXCLUSIVA de mobile (<=767px).
 * No existe versión desktop: en desktop este componente ni siquiera monta
 * (ver MobileFrameSequenceIntro más abajo).
 *
 * Arquitectura, simplificada a propósito tras detectar que un caché con
 * ventana deslizante (decodificar/evictar bajo demanda durante el scroll)
 * podía dejar frames sin decodificar a tiempo: ahora TODO se descarga y
 * decodifica antes de soltar la experiencia. Cero red durante el scroll.
 *
 *  1. Preload: se hace fetch de las 193 (concurrencia limitada, con
 *     reintentos), y LUEGO se decodifican las 193 (`new Image()` +
 *     `.decode()`, concurrencia limitada). El loader no desaparece hasta
 *     que las 193 están realmente decodificadas — no solo descargadas.
 *  2. Render loop: un único listener de scroll → un único rAF → "leer
 *     posición, calcular frame objetivo, pintar directamente esa frame
 *     desde el array ya decodificado". Sin caché con ventana, sin cola de
 *     prioridad, sin eviction: todo ya está listo, así que no hace falta.
 *     La posición real de scroll es la única fuente de verdad
 *     (latest-frame-wins): un fling nunca reproduce frames intermedias.
 *  3. Fuente de imagen: `HTMLImageElement` (no `ImageBitmap`). A
 *     diferencia de un ImageBitmap —que una vez creado ocupa su memoria
 *     entera hasta que algo lo cierre explícitamente—, el backing store
 *     decodificado de un <img> lo gestiona el propio motor del navegador,
 *     que puede liberarlo bajo presión de memoria y volver a decodificarlo
 *     al vuelo la próxima vez que se dibuja — sin red, porque los bytes ya
 *     están servidos desde la cache HTTP. Con las 193 frames retenidas
 *     permanentemente, esto es más seguro en memoria que 193 ImageBitmap
 *     en bruto (~1,1 GB si nada los liberase nunca).
 *  4. Anclaje: sticky + 100dvh (absorbe la barra dinámica de Safari a
 *     nivel CSS) dentro de un spacer de altura fija en vh — sin JS para
 *     el posicionamiento en sí.
 */

const MOBILE_QUERY = '(max-width: 767px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Solo el "Saltar intro" necesita un camino distinto en iOS: revelar
// contenido + saltar el scroll en el mismo tick es estable en Android/
// Chrome, pero en iOS/WebKit produce freezes o transiciones rotas. Todo
// lo demás (preload, render loop, mapping de frames) es idéntico en
// ambas plataformas.
const IS_IOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

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

  return <MobileFrameSequence />;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TOTAL_FRAMES = 193;
const LAST_INDEX = TOTAL_FRAMES - 1;
const SCROLL_VH = 450;

// Revela main/footer/cartbar al terminar la intro. Independiente de la navbar.
const CONTENT_REVEAL_ON = 0.985;
const CONTENT_REVEAL_OFF = 0.965;

// La navbar aparece sobre las últimas frames (168 → 184, 1-based).
const NAVBAR_START_INDEX = 167;
const NAVBAR_END_INDEX = 183;

// Preload: dos fases secuenciales, cada una con su propia concurrencia.
const FETCH_CONCURRENCY = 6;
const DECODE_CONCURRENCY = 6;
const MAX_RETRIES = 3;
// Reparto del progreso mostrado entre "descargado" y "decodificado" — el
// fetch es la parte más lenta/variable (depende de la red), el decode es
// CPU pura y normalmente rápido.
const FETCH_PROGRESS_SHARE = 0.6;

const FONTS_READY_TIMEOUT_MS = 3000;

// Un cambio de altura de viewport por debajo de esto es la barra de
// Safari mostrándose/ocultándose durante el scroll, no un resize real.
const RESIZE_MIN_HEIGHT_DELTA = 150;

function frameSrc(oneBasedIndex: number) {
  return `/sequence-mobile/frame_${String(oneBasedIndex).padStart(6, '0')}.webp`;
}

// ---------------------------------------------------------------------------
// Carga: fetch (red) → decode (<img>+.decode())
// ---------------------------------------------------------------------------

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

/** Decodifica una frame ya presente en la cache HTTP (rápido, sin red real). */
function decodeFrame(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().then(
          () => resolve(img),
          () => resolve(null),
        );
      } else {
        resolve(img);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawFrame(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, img: HTMLImageElement | null) {
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

// ---------------------------------------------------------------------------
// Visuales acopladas al frame index (navbar / badge)
// ---------------------------------------------------------------------------

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

function badgeVisual(frameIndex: number) {
  if (frameIndex <= 7) return { opacity: 1, hidden: false };
  if (frameIndex >= 9) return { opacity: 0, hidden: true };
  const opacity = 1 - (frameIndex - 7) / 2;
  return { opacity, hidden: opacity < 0.05 };
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

function MobileFrameSequence() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reducedMotionReady, setReducedMotionReady] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);

  const [isExperienceReady, setIsExperienceReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const badgeRef = useRef<HTMLButtonElement | null>(null);

  // Única estructura de datos del motor: las 193 frames, en orden, ya
  // decodificadas. Sin caché con ventana, sin eviction, sin cola.
  const framesRef = useRef<Array<HTMLImageElement | null>>(new Array(TOTAL_FRAMES).fill(null));
  const lastGoodIndexRef = useRef(0);

  const skippingRef = useRef(false);
  const doneRef = useRef(false);
  // Generación del salto en curso. Cada clic en "Saltar intro" la
  // incrementa; los callbacks (rAF) de ese clic solo actúan si siguen
  // siendo la generación vigente. Así, si por lo que sea un callback de
  // un salto anterior tardara en ejecutarse, queda invalidado en vez de
  // pisar el resultado del salto más reciente.
  const skipTokenRef = useRef(0);

  const readinessRef = useRef({
    allFramesReady: false, // fetch + decode de las 193, completo
    logoReady: false,
    fontsReady: false,
    canvasReady: false,
    appHydrated: false,
  });

  const checkReady = useCallback(() => {
    const r = readinessRef.current;
    if (r.allFramesReady && r.logoReady && r.fontsReady && r.canvasReady && r.appHydrated) {
      setIsExperienceReady(true);
    }
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

  // --- Canvas ---

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

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
    drawFrame(ctx, canvas, framesRef.current[lastGoodIndexRef.current]);
  }, [getCtx]);

  // --- Preparación: hidratación, logo, fuentes, canvas ---

  useEffect(() => {
    readinessRef.current.appHydrated = true;
    checkReady();
  }, [checkReady]);

  useEffect(() => {
    const img = new Image();
    const settle = () => {
      readinessRef.current.logoReady = true;
      checkReady();
    };
    img.onload = settle;
    img.onerror = settle; // no bloquear indefinidamente por un logo que nunca llega
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
    if (typeof document !== 'undefined' && 'fonts' in document) document.fonts.ready.then(settle).catch(settle);
    else settle();
    const timeout = window.setTimeout(settle, FONTS_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [checkReady]);

  useEffect(() => {
    if (reducedMotion) return;
    resizeCanvas();
    readinessRef.current.canvasReady = true;
    checkReady();
  }, [reducedMotion, resizeCanvas, checkReady]);

  // --- Preload completo: fetch de las 193 → decode de las 193 ---
  // El loader no suelta la experiencia hasta que TODAS están realmente
  // decodificadas (no solo descargadas). Cero red durante el scroll.

  useEffect(() => {
    if (!reducedMotionReady || reducedMotion) return;
    let cancelled = false;
    setLoadFailed(false);

    (async () => {
      // Fase 1: descarga de las 193, concurrencia limitada, con reintentos.
      const allIndices = Array.from({ length: TOTAL_FRAMES }, (_, i) => i);
      let fetchCursor = 0;
      let fetchedCount = 0;
      let failed = false;

      async function fetchWorker() {
        while (!cancelled && !failed && fetchCursor < allIndices.length) {
          const idx = allIndices[fetchCursor];
          fetchCursor += 1;
          const ok = await fetchWithRetry(frameSrc(idx + 1));
          if (cancelled) return;
          if (!ok) {
            failed = true;
            setLoadFailed(true);
            return;
          }
          fetchedCount += 1;
          setLoadProgress(Math.round((fetchedCount / TOTAL_FRAMES) * FETCH_PROGRESS_SHARE * 100));
        }
      }
      await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, fetchWorker));
      if (cancelled || failed) return;

      // Fase 2: decodificación de las 193 (ya en cache HTTP, sin red real).
      let decodeCursor = 0;
      let decodedCount = 0;

      async function decodeWorker() {
        while (!cancelled && !failed && decodeCursor < allIndices.length) {
          const idx = allIndices[decodeCursor];
          decodeCursor += 1;
          const img = await decodeFrame(frameSrc(idx + 1));
          if (cancelled) return;
          if (!img) {
            failed = true;
            setLoadFailed(true);
            return;
          }
          framesRef.current[idx] = img;
          decodedCount += 1;
          const pct = FETCH_PROGRESS_SHARE + (decodedCount / TOTAL_FRAMES) * (1 - FETCH_PROGRESS_SHARE);
          setLoadProgress(Math.round(pct * 100));
          if (idx === 0) {
            lastGoodIndexRef.current = 0;
            setFirstFrameReady(true);
            redrawCurrent();
          }
        }
      }
      await Promise.all(Array.from({ length: DECODE_CONCURRENCY }, decodeWorker));
      if (cancelled || failed) return;

      readinessRef.current.allFramesReady = true;
      checkReady();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotionReady, reducedMotion, retryTick]);

  const handleRetryLoad = useCallback(() => {
    framesRef.current = new Array(TOTAL_FRAMES).fill(null);
    lastGoodIndexRef.current = 0;
    readinessRef.current.allFramesReady = false;
    setFirstFrameReady(false);
    setLoadProgress(0);
    setLoadFailed(false);
    setRetryTick((n) => n + 1);
  }, []);

  // Bloquea el scroll de la página mientras el loader está activo.
  useEffect(() => {
    if (reducedMotion || isExperienceReady) return;
    const { body } = document;
    const prev = { overflow: body.style.overflow, position: body.style.position, width: body.style.width };
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    return () => {
      body.style.overflow = prev.overflow;
      body.style.position = prev.position;
      body.style.width = prev.width;
    };
  }, [reducedMotion, isExperienceReady]);

  /** Revela main/footer/cartbar. La navbar no depende de esto. */
  const setContentRevealed = useCallback((done: boolean) => {
    if (doneRef.current === done) return;
    doneRef.current = done;
    document.documentElement.classList.toggle('nb-intro-done', done);
  }, []);

  /** Estilo inline directo, sin transición CSS: debe reflejar el frame actual al instante. */
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

  // --- Render loop: leer posición → progreso → frame objetivo → pintar ---
  // Todas las frames ya están decodificadas: pintar es una simple lectura
  // de array, nunca depende de una decodificación en curso.

  useEffect(() => {
    if (!reducedMotionReady || reducedMotion || !isExperienceReady) return;

    const maybeCanvas = canvasRef.current;
    const maybeCtx = getCtx();
    if (!maybeCanvas || !maybeCtx) return;
    const canvas = maybeCanvas;
    const ctx = maybeCtx;

    let ticking = false;
    let rafId = 0;

    function computeProgress() {
      const section = sectionRef.current;
      if (!section) return 0;
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return 1;
      return Math.min(Math.max(-rect.top / scrollable, 0), 1);
    }

    function tick() {
      ticking = false;
      if (skippingRef.current) return;

      const section = sectionRef.current;
      if (section && section.getBoundingClientRect().bottom <= 0) {
        // Ya salió de la zona de la intro: no hay nada más que pintar.
        setContentRevealed(true);
        return;
      }

      const progress = computeProgress();
      const frameIndex = Math.min(Math.max(Math.round(progress * LAST_INDEX), 0), LAST_INDEX);

      // Latest-frame-wins: se pinta directamente la frame que corresponde
      // a la posición actual. No hay frames intermedias que "reproducir".
      const img = framesRef.current[frameIndex];
      if (img) {
        lastGoodIndexRef.current = frameIndex;
        drawFrame(ctx, canvas, img);
      } else {
        // No debería pasar (todo se precargó), pero por si un frame
        // puntual falló: se mantiene la última válida, nunca vacío/negro.
        drawFrame(ctx, canvas, framesRef.current[lastGoodIndexRef.current]);
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
  }, [reducedMotionReady, reducedMotion, isExperienceReady, getCtx, updateBadge, updateNavbar, setContentRevealed]);

  // --- Resize / orientación ---
  // 100dvh ya absorbe la barra dinámica de Safari a nivel CSS. Aquí solo
  // hace falta reaccionar a un cambio *real* de tamaño.

  useEffect(() => {
    if (!reducedMotionReady || reducedMotion) return;
    let rafId = 0;
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;

    function apply() {
      lastWidth = window.innerWidth;
      lastHeight = window.innerHeight;
      resizeCanvas();
      redrawCurrent();
    }

    function scheduleApply() {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(apply);
    }

    function onResize() {
      const widthChanged = window.innerWidth !== lastWidth;
      const heightDelta = Math.abs(window.innerHeight - lastHeight);
      if (!widthChanged && heightDelta < RESIZE_MIN_HEIGHT_DELTA) return; // barra de Safari, se ignora
      scheduleApply();
    }

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', scheduleApply);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', scheduleApply);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [reducedMotionReady, reducedMotion, resizeCanvas, redrawCurrent]);

  // --- prefers-reduced-motion: sin scroll forzado ---

  useEffect(() => {
    if (!reducedMotionReady || !reducedMotion) return;
    let cancelled = false;
    decodeFrame(frameSrc(1)).then((img) => {
      if (!cancelled && img) setFirstFrameReady(true);
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

  // --- Limpieza al desmontar ---

  useEffect(() => {
    return () => {
      framesRef.current = new Array(TOTAL_FRAMES).fill(null);
    };
  }, []);

  const handleSkip = useCallback(() => {
    // Deliberadamente NO se comprueba `doneRef.current` aquí: el botón
    // debe ser idempotente y ejecutar siempre el mismo salto, sin
    // importar si ya se saltó antes, si se volvió a subir a la intro, o
    // en qué frame está. `doneRef` solo evita un doble-toggle de la
    // clase CSS dentro de `setContentRevealed`, nunca debe decidir si el
    // clic "cuenta". El único candado real es `skippingRef`, y protege
    // contra una doble ejecución CONCURRENTE del propio salto, no contra
    // clics posteriores separados en el tiempo.
    if (skippingRef.current) return;
    skippingRef.current = true;
    const token = ++skipTokenRef.current;

    // Un <button> que sigue enfocado puede hacer que iOS intente
    // "recentrar" el scroll sobre él en cuanto su posición cambia bajo el
    // dedo: se le quita el foco antes de mover nada.
    (document.activeElement as HTMLElement | null)?.blur?.();

    // Paso común a ambas plataformas: fija la intro en su estado final
    // (frame, navbar, badge) SIN tocar todavía el resto del DOM. No
    // desmonta nada, no resetea `framesRef`, no toca el canvas salvo para
    // pintar la última frame: la secuencia sigue viva y montada.
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) {
      const last = framesRef.current[LAST_INDEX] ?? framesRef.current[lastGoodIndexRef.current];
      drawFrame(ctx, canvas, last);
      lastGoodIndexRef.current = LAST_INDEX;
      updateBadge(LAST_INDEX);
    }
    updateNavbar(LAST_INDEX);

    // Destino único, explícito: el propio <main id="main-content">, cuyo
    // primer hijo es el Hero ("Tu antojo empieza aquí"). El skip navega
    // a ESTA ancla — nunca a "progress = 1" ni a "última frame". El
    // canvas/la secuencia no deciden nunca el destino, solo se pintan en
    // su estado final por estética durante la transición.
    const jumpToPostIntroTarget = () => {
      const postIntroTarget = document.getElementById('main-content');
      if (!postIntroTarget) return true;
      const html = document.documentElement;
      const prevScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto'; // evita que 'smooth' recorra la intro visualmente
      const top = postIntroTarget.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top); // salto directo por pixel, NUNCA scrollIntoView
      html.style.scrollBehavior = prevScrollBehavior;
      // ¿Ya cruzamos el límite real de la intro? Si no, el salto quedó
      // corto (ver comentario más abajo) y hay que reintentarlo.
      return postIntroTarget.getBoundingClientRect().top <= 0.5;
    };

    if (IS_IOS) {
      // iOS/WebKit: revelar el contenido (display:none → block de un
      // subárbol grande, que además dispara la carga de sus imágenes) en
      // el MISMO tick que el salto de scroll de ~450vh es lo que produce
      // el freeze / la transición rota en Safari. Se separan en dos
      // frames sucesivos; el render loop de la secuencia sigue vivo y
      // solo se pausa mientras dura esta breve transición.
      window.requestAnimationFrame(() => {
        if (skipTokenRef.current !== token) return; // superado por un clic más reciente
        setContentRevealed(true);

        window.requestAnimationFrame(() => {
          if (skipTokenRef.current !== token) return;

          // La barra de direcciones de Safari puede mostrarse u
          // ocultarse justo al saltar, según el estado en que ya
          // estuviera ANTES del clic (que difiere entre un skip inicial
          // y uno hecho tras haber scrolleado antes): eso desplaza
          // `window.scrollY` unos píxeles después del `scrollTo` y puede
          // dejar el destino a medio cruzar el límite de la intro. Ahí
          // es donde `tick()` (que sigue vivo) ve "todavía dentro de la
          // intro, progress ≈ 1" y repinta la última frame — pareciendo
          // que el skip "no navegó" sino que "terminó la animación".
          // Se verifica el aterrizaje real durante unos pocos frames
          // (nunca una pelea indefinida contra un momentum continuo,
          // solo la corrección de un posible asentamiento puntual de la
          // toolbar) y el candado sigue activo mientras tanto, así
          // `tick()` no puede pintar nada intermedio durante la
          // verificación.
          let attempts = 0;
          const verify = () => {
            if (skipTokenRef.current !== token) return;
            const landed = jumpToPostIntroTarget();
            attempts += 1;
            if (!landed && attempts < 4) {
              window.requestAnimationFrame(verify);
              return;
            }
            skippingRef.current = false;
          };
          verify();
        });
      });
    } else {
      // Android/desktop: la vía síncrona ya es estable aquí, sin
      // necesidad de repartirla entre varios frames ni de verificar el
      // aterrizaje.
      setContentRevealed(true);
      jumpToPostIntroTarget();
      skippingRef.current = false;
    }
  }, [getCtx, setContentRevealed, updateBadge, updateNavbar]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (reducedMotionReady && reducedMotion) {
    return (
      <div className="nb-intro-overlay nb-intro-overlay--static" aria-hidden="true">
        <div className="nb-intro-static-frame">
          {firstFrameReady ? (
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
