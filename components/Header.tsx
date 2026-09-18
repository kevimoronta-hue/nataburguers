'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { CartIcon } from '@/components/Icons';
import { useCart } from '@/lib/cart';
import { BUSINESS } from '@/lib/config';
import { track } from '@/lib/analytics';
import { scrollToSection } from '@/lib/scroll';

/** Ancla interna sin hash en la URL ni smooth en mobile (ver lib/scroll.ts). */
function onSectionLink(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
  event.preventDefault();
  scrollToSection(id);
}

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
        className={`relative mx-auto flex max-w-shell items-center gap-4 rounded-xl border border-line-brand bg-[rgba(8,7,6,0.84)] pl-4 pr-2 shadow-[inset_0_1px_0_rgba(255,241,214,0.07),0_1px_0_rgba(0,0,0,0.6),0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-[14px] transition-[padding] duration-200 ease-premium motion-reduce:transition-none ${
          compact ? 'py-1' : 'py-2'
        }`}
      >
        {/* Centrado matemático solo en mobile: el logo se ancla al centro
            real de la barra, no al espacio libre entre los demás elementos. */}
        <a
          href="#inicio"
          onClick={(event) => onSectionLink(event, 'inicio')}
          aria-label="Nata Burger's, inicio"
          className="absolute left-1/2 top-1/2 inline-flex shrink-0 -translate-x-1/2 -translate-y-1/2 rounded-[4px] transition-opacity duration-150 ease-premium active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none md:static md:left-auto md:top-auto md:translate-x-0 md:translate-y-0"
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
                {...(link.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : { onClick: (event: React.MouseEvent<HTMLAnchorElement>) => onSectionLink(event, link.href.slice(1)) })}
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
            className={`relative inline-flex h-11 w-11 select-none items-center justify-center rounded-sm border bg-surface text-ink shadow-[inset_0_1px_0_rgba(255,241,214,0.06),0_1px_2px_rgba(0,0,0,0.35)] transition-[transform,background-color,border-color] duration-150 ease-premium hover:border-line-strong hover:bg-surface-hover active:scale-[0.94] active:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none motion-reduce:active:scale-100 ${
              count > 0 ? 'border-line-brand' : 'border-line'
            }`}
          >
            <CartIcon size={20} />
            {count > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-pill bg-brand px-[5px] text-center text-xs font-extrabold leading-5 text-brand-on shadow-[0_0_0_2px_rgba(8,7,6,0.95)]">
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
