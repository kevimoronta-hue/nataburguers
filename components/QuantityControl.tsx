'use client';

import { MinusIcon, PlusIcon, TrashIcon } from '@/components/Icons';

export function QuantityControl({
  quantity,
  label,
  size = 'md',
  onIncrease,
  onDecrease,
  onRemove,
}: {
  quantity: number;
  label: string;
  size?: 'md' | 'sm';
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const removes = quantity <= 1;
  const btn =
    size === 'sm'
      ? 'h-[34px] w-[34px]'
      : 'h-10 w-10';
  // Mismo press que los botones: scale corto con salida rápida.
  const press =
    'select-none transition-[transform,background-color,color] duration-150 ease-premium active:scale-[0.92] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-bright motion-reduce:transition-none motion-reduce:active:scale-100';

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-sm border border-line-strong bg-surface-raised p-0.5 shadow-[inset_0_1px_0_rgba(255,241,214,0.05),0_1px_2px_rgba(0,0,0,0.35)]"
    >
      <button
        type="button"
        onClick={removes ? onRemove : onDecrease}
        aria-label={removes ? `Quitar ${label} del pedido` : `Quitar uno de ${label}`}
        className={`${btn} ${press} inline-flex items-center justify-center rounded-[6px] ${
          removes
            ? 'text-state-danger hover:bg-[rgba(255,77,77,0.1)] active:bg-[rgba(255,77,77,0.14)]'
            : 'text-ink hover:bg-surface-hover hover:text-brand active:bg-surface-hover'
        }`}
      >
        {removes ? <TrashIcon size={16} /> : <MinusIcon size={16} />}
      </button>
      <span
        aria-live="polite"
        className="min-w-[26px] text-center font-ui text-[15px] font-extrabold tabular-nums text-ink-strong"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={`Agregar uno de ${label}`}
        className={`${btn} ${press} inline-flex items-center justify-center rounded-[6px] text-ink hover:bg-surface-hover hover:text-brand active:bg-surface-hover`}
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
}
