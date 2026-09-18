'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { CartIcon } from '@/components/Icons';
import { useCart } from '@/lib/cart';
import { BUSINESS } from '@/lib/config';
import { track } from '@/lib/analytics';

const LINKS = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#menu', label: 'Menú' },
  { href: BUSINESS.mapsUrl, label: 'Ubicación', external: true },
];

export function Header() {
  const { count, openCart } = useCart();
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState('#inicio');

  useEffect(() => {
    function onScroll() {
      setCompact(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const ids = ['inicio', 'menu', 'ubicacion'];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function handleOpenCart() {
    openCart();
    track('open_cart', { item_count: count });
  }

  return (
    <header
      className="site-header fixed inset-x-0 z-nav px-4 pt-3"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className={`relative mx-auto flex max-w-shell items-center gap-4 rounded-xl border border-line-brand bg-[rgba(8,7,6,0.84)] pl-4 pr-2 shadow-nav backdrop-blur-[14px] transition-[padding] duration-200 motion-reduce:transition-none ${
          compact ? 'py-1' : 'py-2'
        }`}
      >
        {/* Centrado matemático solo en mobile: el logo se ancla al centro
            real de la barra, no al espacio libre entre los demás elementos. */}
        <a
          href="#inicio"
          aria-label="Nata Burger's, inicio"
          className="absolute left-1/2 top-1/2 inline-flex shrink-0 -translate-x-1/2 -translate-y-1/2 rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright md:static md:left-auto md:top-auto md:translate-x-0 md:translate-y-0"
        >
          <Image
            src="/nata-burgers-logo.png"
            alt="Nata Burger's"
            width={444}
            height={148}
            priority
            className={`h-11 w-auto object-contain transition-[height] duration-200 motion-reduce:transition-none ${
              compact ? 'md:h-8' : 'md:h-[38px]'
            }`}
          />
        </a>

        <nav aria-label="Navegación principal" className="mx-auto hidden gap-1 md:flex">
          {LINKS.map((link) => {
            const isActive = active === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                aria-current={isActive ? 'true' : undefined}
                className={`relative inline-flex min-h-[44px] items-center rounded-sm px-3 text-[15px] font-bold no-underline transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none ${
                  isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {link.label}
                {isActive ? (
                  <span className="absolute inset-x-3 bottom-2 h-0.5 rounded-pill bg-brand" />
                ) : null}
              </a>
            );
          })}
        </nav>

        <div className="relative z-10 ml-auto flex items-center gap-2 md:ml-0">
          <button
            type="button"
            onClick={handleOpenCart}
            aria-label={count > 0 ? `Ver el pedido, ${count} artículos` : 'Ver el pedido, vacío'}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-sm border border-line bg-surface text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none"
          >
            <CartIcon size={20} />
            {count > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-pill bg-brand px-[5px] text-center text-xs font-extrabold leading-5 text-brand-on">
                {count}
              </span>
            ) : null}
          </button>
          <Button variant="primary" size="sm" href="#menu" className="hidden md:inline-flex">
            Ordenar ahora
          </Button>
        </div>
      </div>
    </header>
  );
}
