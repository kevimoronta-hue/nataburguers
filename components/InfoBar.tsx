import type { ReactNode } from 'react';

export function InfoBar({
  tone = 'quiet',
  icon,
  children,
  className = '',
}: {
  tone?: 'brand' | 'quiet';
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  if (tone === 'brand') {
    return (
      <div
        className={`flex items-center gap-3 rounded-pill bg-gradient-to-r from-brand to-brand-ember px-5 py-4 text-brand-on ${className}`}
      >
        <span className="inline-flex shrink-0">{icon}</span>
        <span className="font-display text-[22px] uppercase leading-6 sm:text-[26px] sm:leading-7">
          {children}
        </span>
      </div>
    );
  }
  return (
    <div
      className={`flex items-center gap-3 rounded-pill border border-line bg-surface px-5 py-4 text-ink ${className}`}
    >
      <span className="inline-flex shrink-0 text-brand">{icon}</span>
      <span className="text-[15px] leading-[23px]">{children}</span>
    </div>
  );
}
