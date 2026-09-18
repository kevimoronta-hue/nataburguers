import type { Category, Product } from '@/types';

/**
 * Fuente única del catálogo. Sale del menú impreso de Nata Burger's.
 * No se añade, quita ni redondea nada sin cambiarlo aquí primero.
 */

export const CATEGORIES: Category[] = [
  { id: 'hamburguesas', name: 'Hamburguesas' },
  { id: 'pechurina', name: 'Pechurina' },
  { id: 'club-sandwich', name: 'Club Sandwich' },
  { id: 'batidas', name: 'Batidas' },
  { id: 'jugos-naturales', name: 'Jugos Naturales' },
];

export const PRODUCTS: Product[] = [
  // Hamburguesas
  {
    id: 'normal-con-papas',
    category: 'hamburguesas',
    name: 'Normal con papas',
    description: 'Carne, queso, tomate y cebolla',
    price: 250,
    image: '/images/hamburguesa-normal.png',
    alt: 'Hamburguesa con carne, queso, tomate y cebolla, servida con papas fritas',
    available: true,
  },
  {
    id: 'clasica-con-papas',
    category: 'hamburguesas',
    name: 'Clásica con papas',
    description: 'Carne, queso doble, tocino, tomate y cebolla',
    price: 300,
    image: '/images/hamburguesa-clasica.png',
    alt: 'Hamburguesa con doble queso y tocino, servida con papas fritas',
    available: true,
    featured: true,
  },
  {
    id: 'angus-con-papas',
    category: 'hamburguesas',
    name: 'Angus con papas',
    description: 'Carne Angus, doble queso, tocino, tomate y cebolla',
    price: 450,
    image: '/images/hamburguesa-angus.png',
    alt: 'Hamburguesa de carne Angus con doble queso y tocino, servida con papas fritas',
    available: true,
  },

  // Pechurina
  {
    id: 'pechurina-pequena',
    category: 'pechurina',
    name: 'Pechurina pequeña',
    price: 250,
    image: '/images/pechurina-pequena.webp',
    alt: 'Porción pequeña de tiras de pollo empanizadas con papas fritas y kétchup',
    available: true,
  },
  {
    id: 'pechurina-grande',
    category: 'pechurina',
    name: 'Pechurina grande',
    price: 400,
    image: '/images/pechurina-grande.webp',
    alt: 'Porción grande de tiras de pollo empanizadas con papas fritas y kétchup',
    available: true,
  },

  // Club Sandwich
  {
    id: 'club-sandwich-pollo',
    category: 'club-sandwich',
    name: 'Club Sandwich de Pollo',
    description: 'Con papas',
    price: 300,
    image: '/images/club-sandwich-pollo.webp',
    alt: 'Club sandwich de pollo cortado en triángulos, servido con papas fritas',
    available: true,
  },
  {
    id: 'club-sandwich-cerdo',
    category: 'club-sandwich',
    name: 'Club Sandwich de Cerdo',
    description: 'Con papas',
    price: 350,
    image: '/images/club-sandwich-cerdo.webp',
    alt: 'Club sandwich de cerdo cortado en triángulos, servido con papas fritas',
    available: true,
  },

  // Batidas
  {
    id: 'batida-fresa-pitahaya',
    category: 'batidas',
    name: 'Fresa con Pitahaya',
    price: 175,
    image: '/images/batida-fresa-pitahaya.webp',
    alt: 'Vaso de batida rosada de fresa y pitahaya con fruta fresca al lado',
    available: true,
    featured: true,
  },
  {
    id: 'batida-fresa-guineo',
    category: 'batidas',
    name: 'Fresa + Guineo',
    price: 150,
    image: '/images/batida-fresa-guineo.png',
    alt: 'Vaso de batida de fresa con guineo',
    available: true,
  },
  {
    id: 'batida-zapote',
    category: 'batidas',
    name: 'Zapote',
    price: 150,
    image: '/images/batida-zapote.webp',
    alt: 'Vaso de batida de zapote con la fruta partida al lado',
    available: true,
  },
  {
    id: 'batida-lechosa',
    category: 'batidas',
    name: 'Lechosa',
    price: 150,
    image: '/images/batida-lechosa.png',
    alt: 'Vaso de batida de lechosa',
    available: true,
  },
  {
    id: 'batida-proteina',
    category: 'batidas',
    name: 'Batida con Proteína',
    price: 200,
    image: '/images/batida-proteina.webp',
    alt: 'Vaso de batida de proteína con guineo y avena al lado',
    available: true,
  },

  // Jugos Naturales
  {
    id: 'jugo-limon',
    category: 'jugos-naturales',
    name: 'Limón',
    price: 75,
    image: '/images/jugo-limon.webp',
    alt: 'Vaso de limonada natural con hielo y limones frescos',
    available: true,
  },
  {
    id: 'jugo-agua-jamaica',
    category: 'jugos-naturales',
    name: 'Agua de Jamaica',
    price: 95,
    image: '/images/jugo-agua-jamaica.png',
    alt: 'Vaso de agua de Jamaica con hielo',
    available: true,
  },
  {
    id: 'jugo-chinola',
    category: 'jugos-naturales',
    name: 'Chinola',
    price: 95,
    image: '/images/jugo-chinola.png',
    alt: 'Vaso de jugo de chinola con hielo y chinolas partidas al lado',
    available: true,
  },
  {
    id: 'jugo-fresa-pina',
    category: 'jugos-naturales',
    name: 'Fresa con Piña',
    price: 95,
    image: '/images/jugo-fresa-pina.png',
    alt: 'Vaso de jugo natural de fresa con piña',
    available: true,
  },
  {
    id: 'jugo-avena-limon',
    category: 'jugos-naturales',
    name: 'Avena con Limón',
    price: 95,
    image: '/images/jugo-limon-avena.png',
    alt: 'Vaso de avena con limón',
    available: true,
  },
];

export const PRODUCTS_BY_ID: Record<string, Product> = Object.fromEntries(
  PRODUCTS.map((product) => [product.id, product]),
);

export function productsInCategory(categoryId: Category['id']): Product[] {
  return PRODUCTS.filter((product) => product.category === categoryId);
}
