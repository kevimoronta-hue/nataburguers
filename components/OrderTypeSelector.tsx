'use client';

import { BagIcon, MopedIcon } from '@/components/Icons';
import { ORDER_TYPES } from '@/lib/config';
import type { OrderType } from '@/types';

const ICONS: Record<OrderType, typeof BagIcon> = {
  takeaway: BagIcon,
  delivery: MopedIcon,
};

/**
 * Selector segmentado "Para llevar / Delivery".
 * Una sola pieza móvil: el "pulgar" activo se desplaza con `transform`
 * (compositor, sin layout), 200 ms con salida rápida. Cada opción es un
 * radio de ≥44 px; el cambio es inmediato al tap y el texto activo cambia
 * de color sin retraso respecto al pulgar.
 */
export function OrderTypeSelector({
  value,
  onChange,
}: {
  value: OrderType;
  onChange: (next: OrderType) => void;
}) {
  const index = Math.max(
    0,
    ORDER_TYPES.findIndex((option) => option.id === value),
  );

  return (
    <div
      role="radiogroup"
      aria-label="Tipo de pedido"
      className="relative grid grid-cols-2 rounded-pill border border-line bg-bg-base p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.55)]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-pill bg-gradient-to-b from-brand to-brand-ember shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_10px_rgba(217,67,0,0.35)] transition-transform duration-200 ease-premium motion-reduce:transition-none"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {ORDER_TYPES.map((option) => {
        const active = option.id === value;
        const Icon = ICONS[option.id];
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={`relative z-10 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-pill px-3 font-ui text-[15px] font-bold transition-[color,transform] duration-150 ease-premium active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none motion-reduce:active:scale-100 ${
              active ? 'text-brand-on' : 'text-ink-muted hover:text-ink'
            }`}
          >
            <Icon size={18} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
