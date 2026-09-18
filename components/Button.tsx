'use client';

import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { scrollToSection } from '@/lib/scroll';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg';

/**
 * Lenguaje común de todos los botones:
 *  - press: scale(0.97) en ~150 ms con salida rápida (ease-premium), sin
 *    rebote; se desactiva con prefers-reduced-motion;
 *  - hover solo con puntero (hoverOnlyWhenSupported en tailwind.config);
 *  - relieve por bordes y una línea de luz interior, nunca por filtros.
 */
const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-md font-ui text-[15px] font-bold leading-4 tracking-[0.01em] no-underline transition-[transform,background-color,border-color,color,box-shadow,filter] duration-150 ease-premium active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100';

const variants: Record<Variant, string> = {
  primary:
    'border border-[rgba(255,255,255,0.12)] bg-gradient-to-b from-brand to-brand-ember text-brand-on shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(0,0,0,0.45),0_8px_22px_rgba(217,67,0,0.32)] hover:from-brand-bright hover:to-brand active:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.45),0_4px_12px_rgba(217,67,0,0.26)]',
  secondary:
    'border border-line-strong bg-surface-raised text-ink shadow-[inset_0_1px_0_rgba(255,241,214,0.06),0_1px_2px_rgba(0,0,0,0.35)] hover:border-ink-muted hover:bg-surface-hover active:bg-surface',
  ghost: 'bg-transparent text-brand hover:bg-surface-hover active:bg-surface',
  danger:
    'border border-transparent bg-transparent text-state-danger hover:border-[rgba(255,77,77,0.35)] hover:bg-[rgba(255,77,77,0.08)] active:bg-[rgba(255,77,77,0.12)]',
  whatsapp:
    'border border-[rgba(255,255,255,0.12)] bg-whatsapp text-whatsapp-on shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(0,0,0,0.45)] hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-[44px] px-4',
  md: 'min-h-[48px] px-5',
  lg: 'min-h-[54px] px-6 text-base',
};

interface Common {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

type ButtonProps = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

function classes({ variant = 'primary', size = 'md', block, className }: Common) {
  return [base, variants[variant], sizes[size], block ? 'w-full' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}

export function Button(props: ButtonProps | LinkProps) {
  const { variant, size, block, icon, className, children, ...rest } = props;
  const cls = classes({ variant, size, block, className, children });

  if (typeof (props as LinkProps).href === 'string') {
    const { href, ...anchorRest } = rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    };
    const external = href.startsWith('http') || href.startsWith('tel:');
    if (external) {
      return (
        <a className={cls} href={href} {...anchorRest}>
          {icon}
          <span>{children}</span>
        </a>
      );
    }
    // Ancla interna: navegación programática (ver lib/scroll.ts), nunca
    // hash en la URL ni next/link. El onClick del consumidor corre primero
    // y puede hacer preventDefault para encargarse él mismo del salto.
    if (href.startsWith('#')) {
      const { onClick, ...linkRest } = anchorRest;
      const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        scrollToSection(href.slice(1));
      };
      return (
        <a className={cls} href={href} onClick={handleClick} {...linkRest}>
          {icon}
          <span>{children}</span>
        </a>
      );
    }
    return (
      <Link className={cls} href={href} {...anchorRest}>
        {icon}
        <span>{children}</span>
      </Link>
    );
  }

  const { type = 'button', ...buttonRest } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className={cls} type={type} {...buttonRest}>
      {icon}
      <span>{children}</span>
    </button>
  );
}
