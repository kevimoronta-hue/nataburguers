/**
 * Único punto del sitio que mueve el scroll de la página o lo bloquea.
 *
 * NAVEGACIÓN INTERNA — `scrollToSection(id)`: reemplaza la navegación
 * nativa por hash (`<a href="#id">`, next/link con "#id"). Motivos:
 *  - el hash quedaba en la URL (/#menu): al recargar, WebKit vuelve a
 *    desplazarse al fragmento en cada layout hasta que el usuario toca,
 *    lo que en mobile pisa el aterrizaje de la intro y del skip;
 *  - next/link con hash hace `scrollIntoView()` SIN desactivar el
 *    `scroll-behavior: smooth` global y después `focus()` sobre el nodo,
 *    todo en la fase de layout, antes de que el drawer haya soltado el
 *    body: en iOS eso deja el scroll en una posición intermedia.
 * En mobile el salto es instantáneo (determinista); en desktop se respeta
 * el `scroll-behavior` del CSS, así que la sensación no cambia.
 * `scrollIntoView` honra `scroll-margin-top`, igual que un ancla nativa.
 *
 * BLOQUEO — `lockScroll()` / `unlockScroll()`: un solo mecanismo para el
 * loader de la intro y para el drawer del pedido. `overflow: hidden` en
 * body no impide el scroll táctil en iOS; `position: fixed` + `top:
 * -scrollY` sí, y al soltar se restaura la posición exacta sin smooth.
 */

const MOBILE_QUERY = '(max-width: 767px)';

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

/** Ejecuta `fn` con el scroll-behavior del <html> forzado a 'auto' (instantáneo). */
function withInstantScroll(fn: () => void) {
  const html = document.documentElement;
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  // Fuerza el recálculo de estilo ANTES de desplazar: sin esto WebKit puede
  // seguir usando el `scroll-behavior: smooth` cacheado del CSS y animar
  // el salto (next/link hace exactamente lo mismo por el mismo motivo).
  html.getClientRects();
  fn();
  html.style.scrollBehavior = prev;
}

/** Desplaza la página hasta la sección `id`. Devuelve false si no existe o no tiene caja. */
export function scrollToSection(id: string): boolean {
  const el = document.getElementById(id);
  if (!el || el.getClientRects().length === 0) return false;
  const jump = () => el.scrollIntoView({ block: 'start' });
  if (isMobile()) withInstantScroll(jump);
  else jump();
  return true;
}

let lockedScrollY: number | null = null;

export function lockScroll() {
  if (lockedScrollY !== null) return;
  lockedScrollY = window.scrollY;
  const { style } = document.body;
  style.position = 'fixed';
  style.top = `${-lockedScrollY}px`;
  style.left = '0';
  style.right = '0';
  style.width = '100%';
  style.overflow = 'hidden';
}

export function unlockScroll() {
  if (lockedScrollY === null) return;
  const y = lockedScrollY;
  lockedScrollY = null;
  const { style } = document.body;
  style.position = '';
  style.top = '';
  style.left = '';
  style.right = '';
  style.width = '';
  style.overflow = '';
  withInstantScroll(() => window.scrollTo(0, y));
}
