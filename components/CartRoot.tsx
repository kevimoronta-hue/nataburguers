'use client';

import type { ReactNode } from 'react';
import { CartProvider, useCartState } from '@/lib/cart';

export function CartRoot({ children }: { children: ReactNode }) {
  const cart = useCartState();
  return (
    <CartProvider value={cart}>
      {children}
      {/* Anuncio accesible al agregar un producto. */}
      <p className="sr-only" role="status" aria-live="polite">
        {cart.lastAdded ? `${cart.lastAdded} agregado al pedido` : ''}
      </p>
    </CartProvider>
  );
}
