'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { PRODUCTS_BY_ID } from '@/data/menu';
import { BUSINESS, CART_STORAGE_KEY } from '@/lib/config';
import type { CartLine, CartLineDetailed } from '@/types';

/* ------------------------------------------------------------------ */
/* Formato de moneda — la única función que escribe pesos en el sitio. */
/* ------------------------------------------------------------------ */

export function formatPrice(amount: number): string {
  return `${BUSINESS.currency}${Math.round(amount).toLocaleString(BUSINESS.locale, {
    maximumFractionDigits: 0,
  })}`;
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

type Action =
  | { type: 'hydrate'; lines: CartLine[] }
  | { type: 'add'; id: string }
  | { type: 'decrease'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

function reducer(state: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case 'hydrate':
      return action.lines;

    case 'add': {
      if (!PRODUCTS_BY_ID[action.id]) return state;
      const existing = state.find((line) => line.id === action.id);
      if (!existing) return [...state, { id: action.id, quantity: 1 }];
      return state.map((line) =>
        line.id === action.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    }

    case 'decrease':
      return state
        .map((line) =>
          line.id === action.id ? { ...line, quantity: line.quantity - 1 } : line,
        )
        .filter((line) => line.quantity > 0);

    case 'remove':
      return state.filter((line) => line.id !== action.id);

    case 'clear':
      return [];

    default:
      return state;
  }
}

/** Solo acepta líneas cuyo producto sigue existiendo en el menú. */
function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const { id, quantity } = entry as Partial<CartLine>;
      if (typeof id !== 'string' || !PRODUCTS_BY_ID[id]) return [];
      if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return [];
      const safe = Math.min(Math.max(Math.floor(quantity), 1), 99);
      return [{ id, quantity: safe }];
    });
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface CartValue {
  lines: CartLineDetailed[];
  count: number;
  subtotal: number;
  deliveryFee: number;
  /** subtotal + envío. El envío se suma UNA vez por pedido. */
  total: number;
  isEmpty: boolean;
  /** false hasta que se ha leído localStorage, para no parpadear. */
  ready: boolean;
  quantityOf: (id: string) => number;
  add: (id: string) => void;
  decrease: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Nombre del último producto agregado, para el anuncio accesible. */
  lastAdded: string | null;
}

const CartContext = createContext<CartValue | null>(null);

export function useCartState(): CartValue {
  const [lines, dispatch] = useReducer(reducer, [] as CartLine[]);
  const [ready, setReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const hydrated = useRef(false);

  // Restaurar
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(CART_STORAGE_KEY);
    } catch {
      stored = null;
    }
    dispatch({ type: 'hydrate', lines: parseStoredCart(stored) });
    hydrated.current = true;
    setReady(true);
  }, []);

  // Guardar
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* modo privado o almacenamiento bloqueado: el pedido sigue funcionando en memoria */
    }
  }, [lines]);

  const detailed = useMemo<CartLineDetailed[]>(
    () =>
      lines.flatMap((line) => {
        const product = PRODUCTS_BY_ID[line.id];
        if (!product) return [];
        return [{ ...line, product, lineTotal: product.price * line.quantity }];
      }),
    [lines],
  );

  const count = useMemo(
    () => detailed.reduce((sum, line) => sum + line.quantity, 0),
    [detailed],
  );
  const subtotal = useMemo(
    () => detailed.reduce((sum, line) => sum + line.lineTotal, 0),
    [detailed],
  );
  const deliveryFee = count > 0 ? BUSINESS.deliveryFee : 0;

  const quantityOf = useCallback(
    (id: string) => lines.find((line) => line.id === id)?.quantity ?? 0,
    [lines],
  );

  const add = useCallback((id: string) => {
    dispatch({ type: 'add', id });
    setLastAdded(PRODUCTS_BY_ID[id]?.name ?? null);
  }, []);

  const decrease = useCallback((id: string) => dispatch({ type: 'decrease', id }), []);
  const remove = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  return {
    lines: detailed,
    count,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    isEmpty: count === 0,
    ready,
    quantityOf,
    add,
    decrease,
    remove,
    clear,
    isOpen,
    openCart,
    closeCart,
    lastAdded,
  };
}

export const CartProvider = CartContext.Provider;

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart debe usarse dentro de <CartRoot>');
  return value;
}
