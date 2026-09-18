'use client';

import { useEffect } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeading } from '@/components/SectionHeading';
import { CATEGORIES, productsInCategory } from '@/data/menu';
import { track } from '@/lib/analytics';

export function MenuSections() {
  useEffect(() => {
    track('view_menu');
  }, []);

  let cardIndex = 0;

  return (
    <div className="mx-auto max-w-shell px-4 pb-10 pt-6 lg:px-6 lg:pb-12">
      {CATEGORIES.map((category) => {
        const products = productsInCategory(category.id);
        return (
          <section key={category.id} className="pt-10 first:pt-2 lg:pt-12">
            <SectionHeading id={category.id}>{category.name}</SectionHeading>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const priority = cardIndex < 2;
                cardIndex += 1;
                return (
                  <ProductCard key={product.id} product={product} priority={priority} />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
