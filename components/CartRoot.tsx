'use client';

import type { ReactNode } from 'react';
import { CartDataProvider, CartUiProvider, useCartState } from '@/lib/cart';

export function CartRoot({ children }: { children: ReactNode }) {
  const { data, ui } = useCartState();
  return (
    <CartDataProvider value={data}>
      <CartUiProvider value={ui}>
        {children}
        {/* Anuncio accesible al agregar un producto. */}
        <p className="sr-only" role="status" aria-live="polite">
          {data.lastAdded ? `${data.lastAdded} agregado al pedido` : ''}
        </p>
      </CartUiProvider>
    </CartDataProvider>
  );
}
