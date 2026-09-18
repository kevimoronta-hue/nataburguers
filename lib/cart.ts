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
import {
  BUSINESS,
  CART_STORAGE_KEY,
  DEFAULT_ORDER_TYPE,
  ORDER_TYPES,
  ORDER_TYPE_STORAGE_KEY,
} from '@/lib/config';
import type { CartLine, CartLineDetailed, OrderType } from '@/types';

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

function parseStoredOrderType(raw: string | null): OrderType {
  return ORDER_TYPES.some((option) => option.id === raw) ? (raw as OrderType) : DEFAULT_ORDER_TYPE;
}

/* ------------------------------------------------------------------ */
/* Contexts                                                            */
/*                                                                     */
/* Dos contextos separados a propósito: los DATOS del pedido (los       */
/* consume todo el catálogo) y el estado de UI del drawer (isOpen, solo */
/* lo consumen Header, CartBar y CartDrawer). Así abrir/cerrar "Pedidos" */
/* no vuelve a renderizar las 22 ProductCard.                          */
/* ------------------------------------------------------------------ */

export interface CartData {
  lines: CartLineDetailed[];
  count: number;
  subtotal: number;
  deliveryFee: number;
  /** subtotal + envío. El envío se suma UNA vez por pedido. */
  total: number;
  isEmpty: boolean;
  /** false hasta que se ha leído localStorage, para no parpadear. */
  ready: boolean;
  /** Para llevar / Delivery. El envío solo se cobra en delivery. */
  orderType: OrderType;
  setOrderType: (next: OrderType) => void;
  quantityOf: (id: string) => number;
  add: (id: string) => void;
  decrease: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** Nombre del último producto agregado, para el anuncio accesible. */
  lastAdded: string | null;
}

export interface CartUi {
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

export type CartValue = CartData & CartUi;

const CartDataContext = createContext<CartData | null>(null);
const CartUiContext = createContext<CartUi | null>(null);

export interface CartState {
  data: CartData;
  ui: CartUi;
}

export function useCartState(): CartState {
  const [lines, dispatch] = useReducer(reducer, [] as CartLine[]);
  const [ready, setReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [orderType, setOrderTypeState] = useState<OrderType>(DEFAULT_ORDER_TYPE);
  const hydrated = useRef(false);

  // Restaurar
  useEffect(() => {
    let storedCart: string | null = null;
    let storedType: string | null = null;
    try {
      storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
      storedType = window.localStorage.getItem(ORDER_TYPE_STORAGE_KEY);
    } catch {
      /* almacenamiento bloqueado */
    }
    dispatch({ type: 'hydrate', lines: parseStoredCart(storedCart) });
    setOrderTypeState(parseStoredOrderType(storedType));
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

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(ORDER_TYPE_STORAGE_KEY, orderType);
    } catch {
      /* idem */
    }
  }, [orderType]);

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
  const deliveryFee = count > 0 && orderType === 'delivery' ? BUSINESS.deliveryFee : 0;

  const setOrderType = useCallback((next: OrderType) => setOrderTypeState(next), []);

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

  const data = useMemo<CartData>(
    () => ({
      lines: detailed,
      count,
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      isEmpty: count === 0,
      ready,
      orderType,
      setOrderType,
      quantityOf,
      add,
      decrease,
      remove,
      clear,
      lastAdded,
    }),
    [
      detailed,
      count,
      subtotal,
      deliveryFee,
      ready,
      orderType,
      setOrderType,
      quantityOf,
      add,
      decrease,
      remove,
      clear,
      lastAdded,
    ],
  );

  const ui = useMemo<CartUi>(() => ({ isOpen, openCart, closeCart }), [isOpen, openCart, closeCart]);

  return { data, ui };
}

export const CartDataProvider = CartDataContext.Provider;
export const CartUiProvider = CartUiContext.Provider;

/** Solo datos del pedido: para el catálogo y el formulario. No se re-renderiza al abrir/cerrar el drawer. */
export function useCartData(): CartData {
  const value = useContext(CartDataContext);
  if (!value) throw new Error('useCartData debe usarse dentro de <CartRoot>');
  return value;
}

/** Solo estado del drawer. */
export function useCartUi(): CartUi {
  const value = useContext(CartUiContext);
  if (!value) throw new Error('useCartUi debe usarse dentro de <CartRoot>');
  return value;
}

/** Fachada para los componentes que necesitan ambos (Header, CartBar, CartDrawer). */
export function useCart(): CartValue {
  const data = useCartData();
  const ui = useCartUi();
  return { ...data, ...ui };
}
