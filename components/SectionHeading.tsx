import type { ReactNode } from 'react';

export function SectionHeading({
  id,
  as: Tag = 'h2',
  children,
  className = '',
}: {
  id?: string;
  as?: 'h2' | 'h3';
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Tag
        id={id}
        className="scroll-mt-[168px] font-display text-[32px] uppercase leading-[34px] tracking-[-0.01em] text-ink sm:text-[40px] sm:leading-10"
      >
        {children}
      </Tag>
      <span
        aria-hidden="true"
        className="block h-[7px] w-24 -skew-x-[18deg] rounded-pill bg-gradient-to-r from-brand to-brand-ember"
      />
    </div>
  );
}
