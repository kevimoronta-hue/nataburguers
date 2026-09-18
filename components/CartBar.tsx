'use client';

import { Button } from '@/components/Button';
import { formatPrice, useCart } from '@/lib/cart';
import { track } from '@/lib/analytics';

/**
 * Barra fija inferior. Misma mecánica en Android e iOS: `bottom: 0` +
 * `env(safe-area-inset-bottom)` en el padding. Sin JS de viewport: en
 * iOS la barra dinámica de Safari reduce el viewport de layout, así que
 * un `fixed; bottom: 0` ya queda por encima de ella; leer visualViewport
 * solo hacía saltar la barra durante la animación de la toolbar.
 */
export function CartBar() {
  const { count, total, openCart, isOpen, ready } = useCart();

  if (!ready || count === 0 || isOpen) return null;

  function handleOpen() {
    openCart();
    track('open_cart', { item_count: count, value: total });
  }

  return (
    <div
      className="site-cartbar fixed inset-x-0 bottom-0 z-cartbar px-0 lg:hidden"
      role="region"
      aria-label="Resumen del pedido"
    >
      <div
        className="flex items-center justify-between gap-4 rounded-t-lg border-t border-line-brand bg-surface-raised px-4 pt-3 shadow-nav"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-[30px] min-w-[30px] items-center justify-center rounded-pill bg-brand px-2 text-sm font-extrabold text-brand-on">
            {count}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-medium leading-4 text-ink-muted">
              {count === 1 ? '1 artículo' : `${count} artículos`}
            </span>
            <span className="font-ui text-lg font-extrabold leading-[22px] tabular-nums text-ink-strong">
              {formatPrice(total)}
            </span>
          </span>
        </div>
        <Button variant="primary" size="md" onClick={handleOpen}>
          Ver pedido
        </Button>
      </div>
    </div>
  );
}
