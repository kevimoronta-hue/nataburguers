import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-ui text-[15px] font-bold leading-4 tracking-[0.01em] no-underline transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none motion-reduce:transition-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand to-brand-ember text-brand-on shadow-brand hover:bg-brand-bright hover:from-brand-bright hover:to-brand-bright active:translate-y-px',
  secondary:
    'bg-surface-raised text-ink border border-line-strong hover:bg-surface-hover',
  ghost: 'bg-transparent text-brand hover:bg-surface-hover',
  whatsapp: 'bg-whatsapp text-whatsapp-on hover:brightness-110',
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
