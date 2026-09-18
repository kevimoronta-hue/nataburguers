import { formatPrice } from '@/lib/cart';

export function PriceTag({
  amount,
  size = 'md',
  className = '',
}: {
  amount: number;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const scale = size === 'sm' ? 'text-[15px] leading-[18px]' : 'text-[20px] leading-[22px]';
  return (
    <span
      className={`font-ui font-extrabold text-brand tabular-nums whitespace-nowrap ${scale} ${className}`}
    >
      {formatPrice(amount)}
    </span>
  );
}
