import { BUSINESS, whatsappLink } from '@/lib/config';
import type { CartLineDetailed, CustomerDetails } from '@/types';

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
  customer,
}: OrderPayload): string {
  const items = lines
    .map((line) => `• ${line.quantity} × ${line.product.name} — ${money(line.lineTotal)}`)
    .join('\n');

  return [
    `Hola, quiero realizar este pedido en ${BUSINESS.name}:`,
    '',
    items,
    '',
    `Subtotal: ${money(subtotal)}`,
    `Envío: ${money(deliveryFee)}`,
    `Total: ${money(total)}`,
    '',
    `Nombre: ${customer.nombre.trim()}`,
    `Teléfono: ${customer.telefono.trim()}`,
    `Dirección: ${customer.direccion.trim()}`,
    `Referencia: ${customer.referencia.trim() || 'No indicada'}`,
    `Nota: ${customer.nota.trim() || 'Sin notas'}`,
    '',
    'Por favor, confirmen la disponibilidad y el tiempo estimado de entrega.',
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

export function validateCustomer(customer: CustomerDetails): CustomerErrors {
  const errors: CustomerErrors = {};
  if (!customer.nombre.trim()) errors.nombre = 'Escribe tu nombre.';
  if (!isValidDominicanPhone(customer.telefono)) {
    errors.telefono = 'Escribe un número de teléfono válido.';
  }
  if (!customer.direccion.trim()) errors.direccion = 'Escribe la dirección de entrega.';
  return errors;
}
