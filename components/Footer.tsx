'use client';

import Image from 'next/image';
import { BUSINESS } from '@/lib/config';
import { scrollToSection } from '@/lib/scroll';

function onSectionLink(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
  event.preventDefault();
  scrollToSection(id);
}

export function Footer() {
  return (
    <footer className="site-footer border-t border-line bg-bg-base">
      <div className="footer-mobile-stack mx-auto flex max-w-shell flex-col gap-6 px-4 py-10 lg:flex-row lg:items-start lg:justify-between lg:px-6">
        <div className="flex flex-col gap-4">
          <Image
            src="/nata-burgers-logo.png"
            alt="Nata Burger's"
            width={444}
            height={148}
            className="h-11 w-auto object-contain"
          />
          <a
            href={BUSINESS.phoneHref}
            className="footer-phone-link w-fit text-[15px] font-bold text-whatsapp no-underline underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright"
          >
            {BUSINESS.phoneDisplay}
          </a>
        </div>

        <nav
          aria-label="Navegación del pie"
          className="footer-nav-mobile flex flex-col gap-2"
        >
          <a
            href="#inicio"
            onClick={(event) => onSectionLink(event, 'inicio')}
            className="text-[15px] text-ink-muted no-underline hover:text-ink"
          >
            Inicio
          </a>
          <a
            href="#menu"
            onClick={(event) => onSectionLink(event, 'menu')}
            className="text-[15px] text-ink-muted no-underline hover:text-ink"
          >
            Menú
          </a>
          <a
            href={BUSINESS.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[15px] text-ink-muted no-underline hover:text-ink"
          >
            Ubicación
          </a>
        </nav>
      </div>

      <div className="border-t border-line">
        <div
          className="footer-scalia-brand mx-auto max-w-shell px-4 py-4 lg:px-6"
          style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
        >
          <Image
            src="/images/scalia-logo.png"
            alt="Powered by Scalia"
            width={2172}
            height={724}
            className="h-7 w-auto object-contain opacity-80"
          />
        </div>
      </div>
    </footer>
  );
}
