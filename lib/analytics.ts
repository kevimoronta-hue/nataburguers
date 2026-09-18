/**
 * Eventos del recorrido de pedido.
 *
 * Nunca se envían datos personales: ni nombre, ni teléfono, ni dirección,
 * ni referencia, ni nota del pedido. El tipo de payload lo impide.
 */

export type AnalyticsEvent =
  | 'view_menu'
  | 'select_category'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'open_cart'
  | 'begin_order'
  | 'whatsapp_order_click'
  | 'phone_click';

/** Solo identificadores del catálogo y cifras. Nada escrito por la persona. */
export interface AnalyticsPayload {
  category_id?: string;
  product_id?: string;
  quantity?: number;
  item_count?: number;
  value?: number;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}): void {
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ...payload });
  } catch {
    /* si el contenedor de analítica no está, el pedido sigue igual */
  }
}
