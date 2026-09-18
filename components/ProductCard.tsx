'use client';

import Image from 'next/image';
import { AlertIcon } from '@/components/Icons';
import { Button } from '@/components/Button';
import { PriceTag } from '@/components/PriceTag';
import { QuantityControl } from '@/components/QuantityControl';
import { useCartData } from '@/lib/cart';
import { track } from '@/lib/analytics';
import type { Product } from '@/types';

export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  // Solo datos: abrir/cerrar el drawer no re-renderiza el catálogo.
  const { quantityOf, add, decrease, remove } = useCartData();
  const quantity = quantityOf(product.id);
  const unavailable = !product.available;

  function handleAdd() {
    add(product.id);
    track('add_to_cart', { product_id: product.id, value: product.price });
  }

  function handleDecrease() {
    decrease(product.id);
    track('remove_from_cart', { product_id: product.id });
  }

  function handleRemove() {
    remove(product.id);
    track('remove_from_cart', { product_id: product.id });
  }

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card transition-colors duration-200 motion-reduce:transition-none ${
        unavailable ? '' : 'md:hover:border-line-strong md:hover:bg-surface-hover'
      }`}
    >
      <div className={`relative aspect-[4/3] bg-bg-base ${unavailable ? 'opacity-45' : ''}`}>
        <Image
          src={product.image}
          alt={product.alt}
          fill
          sizes="(min-width: 1024px) 352px, (min-width: 640px) 45vw, 92vw"
          priority={priority}
          className="object-cover"
        />
        {product.featured && !unavailable ? (
          <span className="absolute left-3 top-3 rounded-pill bg-brand px-3 py-[5px] text-xs font-extrabold uppercase tracking-[0.06em] text-brand-on">
            Más pedida
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3
          className={`font-ui text-base font-bold leading-[22px] ${
            unavailable ? 'text-ink opacity-45' : 'text-ink'
          }`}
        >
          {product.name}
        </h3>
        {product.description ? (
          <p
            className={`text-[15px] leading-[23px] text-ink-muted ${
              unavailable ? 'opacity-45' : ''
            }`}
          >
            {product.description}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <PriceTag amount={product.price} />
          {unavailable ? (
            <span className="inline-flex items-center gap-1 text-[13px] font-bold text-state-warning">
              <AlertIcon size={15} />
              Agotado
            </span>
          ) : quantity > 0 ? (
            <QuantityControl
              quantity={quantity}
              label={product.name}
              onIncrease={handleAdd}
              onDecrease={handleDecrease}
              onRemove={handleRemove}
            />
          ) : (
            <Button variant="primary" size="sm" onClick={handleAdd}>
              Agregar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
