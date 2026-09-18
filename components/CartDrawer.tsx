'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/Button';
import { CheckoutForm } from '@/components/CheckoutForm';
import { CloseIcon } from '@/components/Icons';
import { QuantityControl } from '@/components/QuantityControl';
import { formatPrice, useCart } from '@/lib/cart';
import { BUSINESS } from '@/lib/config';
import { track } from '@/lib/analytics';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function CartDrawer() {
  const { isOpen, closeCart, lines, count, subtotal, deliveryFee, total, add, decrease, remove, clear } =
    useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCart();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [closeCart],
  );

  useEffect(() => {
    if (!isOpen) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    closeRef.current?.focus();
    if (count > 0) track('begin_order', { item_count: count, value: total });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-drawer">
      <button
        type="button"
        aria-label="Cerrar el pedido"
        onClick={closeCart}
        className="absolute inset-0 h-full w-full cursor-default bg-bg-base/[0.72] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-line bg-bg-subtle shadow-drawer sm:rounded-l-xl"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id="cart-title" className="font-display text-[26px] uppercase leading-7 text-ink">
            Tu pedido
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeCart}
            aria-label="Cerrar el pedido"
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-line bg-surface text-ink transition-colors duration-150 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none"
          >
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {count === 0 ? (
            <div className="flex flex-col items-start gap-3 py-10">
              <p className="font-ui text-base font-bold text-ink">Tu carrito está vacío.</p>
              <p className="text-[15px] leading-[23px] text-ink-muted">
                Agrega algo rico del menú para comenzar.
              </p>
              <Button variant="primary" size="md" href="#menu" onClick={closeCart}>
                Ver el menú
              </Button>
            </div>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-line">
                {lines.map((line) => (
                  <li key={line.id} className="flex items-center gap-3 py-3 first:pt-0">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-bg-base">
                      <Image
                        src={line.product.image}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-ui text-[15px] font-bold leading-5 text-ink">
                        {line.product.name}
                      </span>
                      <span className="font-ui text-[15px] font-extrabold leading-[18px] tabular-nums text-brand">
                        {formatPrice(line.lineTotal)}
                      </span>
                    </div>
                    <QuantityControl
                      quantity={line.quantity}
                      label={line.product.name}
                      size="sm"
                      onIncrease={() => add(line.id)}
                      onDecrease={() => decrease(line.id)}
                      onRemove={() => remove(line.id)}
                    />
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
                <div className="flex justify-between text-[15px] text-ink-muted">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[15px] text-ink-muted">
                  <span>Envío</span>
                  <span className="tabular-nums">{formatPrice(deliveryFee)}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2 font-ui text-lg font-extrabold text-ink-strong">
                  <span>Total</span>
                  <span className="tabular-nums">{formatPrice(total)}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                <Button variant="secondary" size="sm" href="#menu" onClick={closeCart}>
                  Seguir pidiendo
                </Button>
                <Button variant="ghost" size="sm" onClick={clear}>
                  Vaciar carrito
                </Button>
              </div>

              <div className="mt-6 border-t border-line pt-5">
                <h3 className="font-display text-[22px] uppercase leading-6 text-ink">
                  Datos de entrega
                </h3>
                <p className="mb-4 mt-1 text-[13px] leading-5 text-ink-muted">
                  {BUSINESS.name} no cobra en línea. Solo necesitamos saber a dónde llevarlo.
                </p>
                <CheckoutForm />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
