import type { AdminOrder, AdminOrderItem, AdminProduct, AdminProductVariant } from "@/lib/contracts/admin";
import type { OrderStatus, ProductType } from "@/lib/contracts/storefront";
import { mapProduct } from "@/lib/server/storefront";

interface DbRecord { [key: string]: unknown }
const record = (value: unknown): DbRecord => typeof value === "object" && value !== null && !Array.isArray(value) ? value as DbRecord : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";
const nullableText = (value: unknown): string | null => typeof value === "string" ? value : null;
const num = (value: unknown): number => typeof value === "number" ? value : Number.isFinite(Number(value)) ? Number(value) : 0;

export function mapAdminProduct(value: unknown): AdminProduct {
  const row = record(value);
  const product = mapProduct(value);
  const variants: AdminProductVariant[] = Array.isArray(row.variants) ? row.variants.map((item) => {
    const variant = record(item);
    return {
      id: text(variant.id),
      productId: text(variant.product_id),
      sizeLabel: text(variant.size_label),
      price: text(variant.price),
      compareAtPrice: nullableText(variant.compare_at_price),
      stockQuantity: num(variant.stock_quantity),
      isActive: variant.is_active === true,
      lowStockThreshold: num(variant.low_stock_threshold),
    };
  }) : [];
  return {
    ...product,
    brandId: nullableText(row.brand_id),
    categoryId: nullableText(row.category_id),
    originCountry: nullableText(row.origin_country),
    isPublished: row.is_published === true,
    variants,
  };
}

export function mapAdminOrder(value: unknown): AdminOrder {
  const row = record(value);
  const items: AdminOrderItem[] = Array.isArray(row.items) ? row.items.map((item) => {
    const line = record(item);
    return {
      productId: nullableText(line.product_id),
      variantId: nullableText(line.variant_id),
      productNameSnapshot: text(line.product_name_snapshot),
      productTypeSnapshot: line.product_type_snapshot === "original" ? "original" : "blended" as ProductType,
      variantNameSnapshot: text(line.variant_name_snapshot),
      unitPriceSnapshot: text(line.unit_price_snapshot),
      quantity: num(line.quantity),
      lineTotal: text(line.line_total),
    };
  }) : [];
  const status = text(row.status) as OrderStatus;
  return {
    id: text(row.id),
    orderNumber: text(row.order_number),
    status,
    subtotal: text(row.subtotal),
    currency: "ILS",
    deliveryCost: nullableText(row.delivery_cost),
    customerName: nullableText(row.customer_name),
    customerPhone: nullableText(row.customer_phone),
    notes: nullableText(row.notes),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    confirmedAt: nullableText(row.confirmed_at),
    items,
  };
}
