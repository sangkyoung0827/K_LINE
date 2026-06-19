"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, GoodsItem } from "@/types";

type CartContextValue = {
  items: CartLine[];
  totalQuantity: number;
  estimatedTotalEur: number;
  addItem: (item: GoodsItem, quantity?: number) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
};

const CART_KEY = "k_line_cart";
const CartContext = createContext<CartContextValue | null>(null);

function toCartLine(item: GoodsItem, quantity: number): CartLine {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    koreanName: item.koreanName,
    pricePlaceholder: item.pricePlaceholder,
    estimatedPriceEur: item.estimatedPriceEur,
    image: item.images[0],
    quantity
  };
}

function normalizeCartLines(lines: CartLine[]): CartLine[] {
  return lines.map((line) => ({
    ...line,
    quantity: Math.max(1, Number(line.quantity) || 1)
  }));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CART_KEY);
    if (stored) {
      try {
        setItems(normalizeCartLines(JSON.parse(stored) as CartLine[]));
      } catch {
        setItems([]);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    }
  }, [hydrated, items]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      estimatedTotalEur: items.reduce(
        (sum, item) => sum + item.estimatedPriceEur * item.quantity,
        0
      ),
      addItem: (item, quantity = 1) => {
        setItems((current) => {
          const existing = current.find((line) => line.slug === item.slug);
          if (!existing) {
            return [...current, toCartLine(item, quantity)];
          }
          return current.map((line) =>
            line.slug === item.slug ? { ...line, quantity: line.quantity + quantity } : line
          );
        });
      },
      updateQuantity: (slug, quantity) => {
        setItems((current) =>
          current.map((line) =>
            line.slug === slug ? { ...line, quantity: Math.max(1, quantity) } : line
          )
        );
      },
      removeItem: (slug) => {
        setItems((current) => current.filter((line) => line.slug !== slug));
      },
      clearCart: () => {
        setItems([]);
      }
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return context;
}
