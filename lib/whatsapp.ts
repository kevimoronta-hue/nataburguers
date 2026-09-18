import { BUSINESS, ORDER_TYPES, whatsappLink } from '@/lib/config';
import type { CartLineDetailed, CustomerDetails, OrderType } from '@/types';

export function orderTypeLabel(orderType: OrderType): string {
  return ORDER_TYPES.find((option) => option.id === orderType)?.label ?? orderType;
}

function money(amount: number): string {
  return `${BUSINESS.currency}${Math.round(amount).toLocaleString(BUSINESS.locale, {
    maximumFractionDigits: 0,
  })}`;
}

export interface OrderPayload {
  lines: CartLineDetailed[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  orderType: OrderType;
  customer: CustomerDetails;
}

/**
 * El cuerpo exacto del pedido. No dice en ningún momento que esté
 * confirmado: pide al restaurante que confirme.
 */
export function buildOrderMessage({
  lines,
  subtotal,
  deliveryFee,
  total,
  orderType,
  customer,
}: OrderPayload): string {
  const isDelivery = orderType === 'delivery';
  const items = lines
    .map((line) => `• ${line.quantity} × ${line.product.name} — ${money(line.lineTotal)}`)
    .join('\n');

  return [
    `Hola, quiero realizar este pedido en ${BUSINESS.name}:`,
    '',
    `Tipo de pedido: ${orderTypeLabel(orderType)}`,
    '',
    items,
    '',
    `Subtotal: ${money(subtotal)}`,
    ...(isDelivery ? [`Envío: ${money(deliveryFee)}`] : []),
    `Total: ${money(total)}`,
    '',
    `Nombre: ${customer.nombre.trim()}`,
    `Teléfono: ${customer.telefono.trim()}`,
    ...(isDelivery
      ? [
          `Dirección: ${customer.direccion.trim()}`,
          `Referencia: ${customer.referencia.trim() || 'No indicada'}`,
        ]
      : []),
    `Nota: ${customer.nota.trim() || 'Sin notas'}`,
    '',
    isDelivery
      ? 'Por favor, confirmen la disponibilidad y el tiempo estimado de entrega.'
      : 'Por favor, confirmen la disponibilidad y a qué hora puedo pasar a recogerlo.',
  ].join('\n');
}

export function buildOrderUrl(payload: OrderPayload): string {
  return whatsappLink(buildOrderMessage(payload));
}

/* ------------------------------------------------------------------ */
/* Validación                                                          */
/* ------------------------------------------------------------------ */

export type CustomerErrors = Partial<Record<keyof CustomerDetails, string>>;

/** Acepta los formatos dominicanos corrientes: 8096859204, 809-685-9204, +1 809 685 9204. */
export function isValidDominicanPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return /^(809|829|849)/.test(digits);
  if (digits.length === 11) return /^1(809|829|849)/.test(digits);
  return false;
}

export function validateCustomer(customer: CustomerDetails, orderType: OrderType): CustomerErrors {
  const errors: CustomerErrors = {};
  if (!customer.nombre.trim()) errors.nombre = 'Escribe tu nombre.';
  if (!isValidDominicanPhone(customer.telefono)) {
    errors.telefono = 'Escribe un número de teléfono válido.';
  }
  // La dirección solo es obligatoria cuando hay que llevar el pedido.
  if (orderType === 'delivery' && !customer.direccion.trim()) {
    errors.direccion = 'Escribe la dirección de entrega.';
  }
  return errors;
}
