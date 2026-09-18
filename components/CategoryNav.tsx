'use client';

import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from '@/data/menu';
import { track } from '@/lib/analytics';

export function CategoryNav() {
  const [active, setActive] = useState<string>(CATEGORIES[0].id);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const sections = CATEGORIES.map((category) => document.getElementById(category.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-180px 0px -60% 0px', threshold: [0, 0.2, 0.6, 1] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // Mantener el chip activo a la vista en móvil.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const chip = list.querySelector<HTMLElement>(`[data-category="${active}"]`);
    if (!chip) return;
    const chipLeft = chip.offsetLeft;
    const chipRight = chipLeft + chip.offsetWidth;
    if (chipLeft < list.scrollLeft || chipRight > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(chipLeft - 16, 0), behavior: 'smooth' });
    }
  }, [active]);

  return (
    <div
      className="sticky z-categories bg-bg-base/95 py-3"
      style={{ top: 'calc(74px + env(safe-area-inset-top, 0px))' }}
    >
      <nav aria-label="Categorías del menú" className="mx-auto max-w-shell px-4 lg:px-6">
        <ul
          ref={listRef}
          className="mobile-category-nav flex min-w-full gap-1 overflow-x-auto rounded-pill border border-line bg-surface-raised p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {CATEGORIES.map((category) => {
            const isActive = category.id === active;
            return (
              <li key={category.id} className="shrink-0" style={{ scrollSnapAlign: 'start' }}>
                <a
                  data-category={category.id}
                  href={`#${category.id}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => track('select_category', { category_id: category.id })}
                  className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-pill px-4 text-[15px] font-bold no-underline transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none ${
                    isActive
                      ? 'bg-gradient-to-b from-brand to-brand-ember text-brand-on'
                      : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                  }`}
                >
                  {category.name}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
