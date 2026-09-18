export type CategoryId =
  | 'hamburguesas'
  | 'pechurina'
  | 'club-sandwich'
  | 'batidas'
  | 'jugos-naturales';

export interface Category {
  id: CategoryId;
  name: string;
}

export interface Product {
  id: string;
  category: CategoryId;
  name: string;
  /** Ingredientes exactos del menú oficial. Ausente cuando el menú no los lista. */
  description?: string;
  /** Pesos dominicanos, entero. El prefijo RD$ lo pone PriceTag. */
  price: number;
  image: string;
  alt: string;
  available: boolean;
  featured?: boolean;
}

export interface CartLine {
  id: string;
  quantity: number;
}

export interface CartLineDetailed extends CartLine {
  product: Product;
  lineTotal: number;
}

/** Cómo se entrega el pedido. Base para zonas, costes e instrucciones de envío futuras. */
export type OrderType = 'takeaway' | 'delivery';

export interface CustomerDetails {
  nombre: string;
  telefono: string;
  direccion: string;
  referencia: string;
  nota: string;
}

export type CustomerField = keyof CustomerDetails;
