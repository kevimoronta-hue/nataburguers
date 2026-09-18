/**
 * Datos confirmados del negocio. Todo lo que el sitio muestre sobre
 * Nata Burger's sale de aquí — no se escribe a mano en los componentes.
 */
export const BUSINESS = {
  name: "Nata Burger's",
  tagline: 'Comida rápida de calidad',
  address: 'Plaza Satélite Duarte, Primera Etapa, Gimnasio Nata Gym',
  /** Como se muestra a la persona. */
  phoneDisplay: '809-685-9204',
  /** Como se marca desde el teléfono. */
  phoneHref: 'tel:+18096859204',
  /** Solo dígitos, para el enlace wa.me. */
  whatsappNumber: '18096859204',
  /** Ubicación en Google Maps. */
  mapsUrl: 'https://maps.app.goo.gl/33bzbHkeBmVnYiT36?g_st=ic',
  /** RD$50, una sola vez por pedido. Nunca por producto. */
  deliveryFee: 50,
  currency: 'RD$',
  locale: 'es-DO',
} as const;

/** Cambia esto por el dominio real antes de desplegar. */
export const SITE_URL = 'https://nataburgers.com';

export const CART_STORAGE_KEY = 'nata-burgers:cart:v1';

/** Límites de los campos del formulario. El texto acaba en una URL. */
export const FIELD_LIMITS = {
  nombre: 60,
  telefono: 20,
  direccion: 200,
  referencia: 120,
  nota: 240,
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
