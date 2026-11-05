"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product, ProductVariant } from "@/lib/contracts/storefront";
import { toMinorUnits } from "@/lib/money";

const STORAGE_KEY = "rasha-cart-v1";

export interface CartVariantOption {
  id: string;
  sizeLabel: string;
  price: string;
  stockQuantity: number;
  isActive: boolean;
}

export interface CartLine {
  variantId: string;
  productSlug: string;
  productName: string;
  productType: Product["productType"];
  imageUrl: string | null;
  sizeLabel: string;
  unitPrice: string;
  stockQuantity: number;
  quantity: number;
  variants: CartVariantOption[];
}

type CartContextValue = {
  lines: CartLine[];
  ready: boolean;
  itemCount: number;
  subtotal: number;
  add: (product: Product, variant: ProductVariant, quantity?: number) => { ok: boolean; message: string };
  changeVariant: (variantId: string, nextVariantId: string) => { ok: boolean; message: string };
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Partial<CartLine>;
  return typeof line.variantId === "string" && typeof line.productSlug === "string" &&
    typeof line.productName === "string" && (line.productType === "original" || line.productType === "blended") &&
    typeof line.sizeLabel === "string" && typeof line.unitPrice === "string" &&
    typeof line.stockQuantity === "number" && typeof line.quantity === "number" && Array.isArray(line.variants);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setLines(saved.filter(isCartLine));
    } catch { setLines([]); } finally { setReady(true); }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); } catch { /* Keep the in-memory cart usable. */ }
  }, [lines, ready]);

  const add = useCallback((product: Product, variant: ProductVariant, quantity = 1) => {
    if (!variant.isActive || variant.stockQuantity < 1) return { ok: false, message: "هذا الحجم غير متوفر حالياً." };
    const amount = Math.max(1, Math.floor(quantity));
    const existing = lines.find((line) => line.variantId === variant.id);
    const nextQuantity = Math.min(variant.stockQuantity, (existing?.quantity || 0) + amount);
    if (nextQuantity <= (existing?.quantity || 0)) return { ok: false, message: "وصلت للكمية المتوفرة من هذا الحجم." };
    const image = product.images.find((item) => item.isPrimary) || product.images[0];
    const nextLine: CartLine = {
      variantId: variant.id,
      productSlug: product.slug,
      productName: product.name,
      productType: product.productType,
      imageUrl: image?.imageUrl || null,
      sizeLabel: variant.sizeLabel,
      unitPrice: variant.price,
      stockQuantity: variant.stockQuantity,
      quantity: nextQuantity,
      variants: product.variants.map((entry) => ({ id: entry.id, sizeLabel: entry.sizeLabel, price: entry.price, stockQuantity: entry.stockQuantity, isActive: entry.isActive })),
    };
    setLines(existing ? lines.map((line) => line.variantId === variant.id ? nextLine : line) : [...lines, nextLine]);
    return { ok: true, message: "أُضيف العطر إلى سلتك." };
  }, [lines]);

  const changeVariant = useCallback((variantId: string, nextVariantId: string) => {
    const line = lines.find((item) => item.variantId === variantId);
    const next = line?.variants.find((item) => item.id === nextVariantId);
    if (!line || !next || !next.isActive || next.stockQuantity < 1) return { ok: false, message: "هذا الحجم غير متوفر حالياً." };
    const other = lines.find((item) => item.variantId === next.id);
    const quantity = Math.min(next.stockQuantity, line.quantity + (other?.quantity || 0));
    const updated: CartLine = { ...line, variantId: next.id, sizeLabel: next.sizeLabel, unitPrice: next.price, stockQuantity: next.stockQuantity, quantity };
    setLines(lines.filter((item) => item.variantId !== variantId && item.variantId !== next.id).concat(updated));
    return { ok: true, message: "تغيّر الحجم." };
  }, [lines]);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((current) => current.map((line) => line.variantId !== variantId ? line : {
      ...line,
      quantity: Math.max(1, Math.min(line.stockQuantity, Math.floor(quantity))),
    }));
  }, []);

  const remove = useCallback((variantId: string) => setLines((current) => current.filter((line) => line.variantId !== variantId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => ({
    lines,
    ready,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + toMinorUnits(line.unitPrice) * line.quantity, 0),
    add,
    changeVariant,
    setQuantity,
    remove,
    clear,
  }), [lines, ready, add, changeVariant, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
