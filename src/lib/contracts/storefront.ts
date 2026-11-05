export type ProductType = "original" | "blended";

export type OrderStatus =
  | "whatsapp_initiated"
  | "contacted"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/** Decimal values cross the API as strings to preserve PostgreSQL NUMERIC precision. */
export type DecimalString = string;
export type CurrencyCode = "ILS";

export interface Brand {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  displayOrder: number;
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  altText: string | null;
  displayOrder: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sizeLabel: string;
  price: DecimalString;
  compareAtPrice: DecimalString | null;
  stockQuantity: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productType: ProductType;
  brand: Brand | null;
  category: Category | null;
  scentFamily: string | null;
  originCountry: string | null;
  notes: string[];
  isFeatured: boolean;
  isBestSeller: boolean;
  displayOrder: number;
  createdAt: string;
  images: ProductImage[];
  variants: ProductVariant[];
}

export type ProductSort = "newest" | "price_asc" | "price_desc";

export interface ProductListQuery {
  search?: string;
  productType?: ProductType;
  categorySlug?: string;
  brandId?: string;
  scentFamily?: string;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ProductsResponse {
  items: Product[];
  pagination: Pagination;
  facets: {
    brands: Brand[];
    scentFamilies: string[];
  };
}

export interface CategoriesResponse {
  items: Category[];
}

export interface ProductDetailResponse {
  item: Product;
}

export interface HomePromoBar {
  text: string;
  linkUrl: string | null;
}

export interface HomeHero {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
}

export interface HomeBanner {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  linkUrl: string | null;
  displayOrder: number;
}

export interface HomeSection {
  id: string;
  sectionKey: string;
  title: string;
  description: string | null;
  displayOrder: number;
  settings: Record<string, unknown> & { imageUrl?: string | null };
  productIds: string[];
  products: Product[];
}

export interface ApprovedReviewSummary {
  id: string;
  productId: string;
  productName: string;
  customerName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface HomeResponse {
  hero: HomeHero | null;
  promoBar: HomePromoBar | null;
  banners: HomeBanner[];
  sections: HomeSection[];
  reviews: ApprovedReviewSummary[];
}

export interface StorefrontContactInfo {
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface StorefrontSettings {
  storeName: string;
  whatsappNumber: string;
  policies: Record<string, string>;
  contactInfo: StorefrontContactInfo;
}

export type StorefrontSettingsResponse = StorefrontSettings;

export interface CreateReviewRequest {
  productId: string;
  customerName: string;
  rating: number;
  comment?: string;
}

export interface CreateReviewResponse {
  item: {
    id: string;
    status: "pending";
    createdAt: string;
  };
}

export interface CreateOrderItemRequest {
  variantId: string;
  quantity: number;
}

/** The client never sends prices, totals, stock, or delivery cost. */
export interface CreateOrderRequest {
  items: CreateOrderItemRequest[];
  idempotencyKey: string;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
}

export interface OrderItemSnapshot {
  productName: string;
  productType: ProductType;
  variantName: string;
  quantity: number;
  unitPrice: DecimalString;
  lineTotal: DecimalString;
}

export interface CreateOrderResponse {
  orderId: string;
  orderNumber: string;
  status: "whatsapp_initiated";
  subtotal: DecimalString;
  currency: CurrencyCode;
  /** Delivery cost is agreed on WhatsApp and is unknown when the order is created. */
  deliveryCost: null;
  items: OrderItemSnapshot[];
  whatsappUrl: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

export interface ValidationIssue {
  field: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Shape validation shared by callers; the server must repeat validation and authorization. */
export function validateCreateOrderRequest(input: unknown): ValidationResult<CreateOrderRequest> {
  if (!isRecord(input)) {
    return { ok: false, issues: [{ field: "body", message: "Expected an object." }] };
  }

  const issues: ValidationIssue[] = [];
  const items: CreateOrderItemRequest[] = [];

  if (!Array.isArray(input.items) || input.items.length === 0) {
    issues.push({ field: "items", message: "Add at least one item." });
  } else {
    input.items.forEach((item, index) => {
      if (!isRecord(item)) {
        issues.push({ field: `items.${index}`, message: "Expected an item object." });
        return;
      }
      const variantId = typeof item.variantId === "string" ? item.variantId.trim() : "";
      if (variantId.length === 0) {
        issues.push({ field: `items.${index}.variantId`, message: "Choose a product size." });
      }
      if (typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        issues.push({ field: `items.${index}.quantity`, message: "Quantity must be a positive whole number." });
      }
      if (variantId.length > 0 && typeof item.quantity === "number" && Number.isSafeInteger(item.quantity) && item.quantity >= 1) {
        items.push({ variantId, quantity: item.quantity });
      }
    });
  }

  const idempotencyKey = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";
  if (idempotencyKey.length === 0) {
    issues.push({ field: "idempotencyKey", message: "A request key is required." });
  }

  const optionalString = (field: "customerName" | "customerPhone" | "notes", maxLength: number): string | undefined => {
    const value = input[field];
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string") {
      issues.push({ field, message: "Expected text." });
      return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length > maxLength) {
      issues.push({ field, message: `Must be ${maxLength} characters or fewer.` });
      return undefined;
    }
    return trimmed || undefined;
  };

  const customerName = optionalString("customerName", 120);
  const customerPhone = optionalString("customerPhone", 40);
  const notes = optionalString("notes", 2000);

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: {
      items,
      idempotencyKey,
      ...(customerName ? { customerName } : {}),
      ...(customerPhone ? { customerPhone } : {}),
      ...(notes ? { notes } : {}),
    },
  };
}

/** Basic client validation for review UX; the server must revalidate and rate-limit. */
export function validateCreateReviewRequest(input: unknown): ValidationResult<CreateReviewRequest> {
  if (!isRecord(input)) {
    return { ok: false, issues: [{ field: "body", message: "Expected an object." }] };
  }

  const issues: ValidationIssue[] = [];
  const productId = typeof input.productId === "string" ? input.productId.trim() : "";
  const customerName = typeof input.customerName === "string" ? input.customerName.trim() : "";
  const rating = input.rating;
  const commentValue = input.comment;
  const comment = typeof commentValue === "string" ? commentValue.trim() : undefined;

  if (!productId) issues.push({ field: "productId", message: "Choose a product." });
  if (!customerName || customerName.length > 120 || /[<>]/.test(customerName)) {
    issues.push({ field: "customerName", message: "Name must be plain text and 120 characters or fewer." });
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    issues.push({ field: "rating", message: "Rating must be a whole number from 1 to 5." });
  }
  if (commentValue !== undefined && commentValue !== null && typeof commentValue !== "string") {
    issues.push({ field: "comment", message: "Expected text." });
  } else if (comment && comment.length > 2000) {
    issues.push({ field: "comment", message: "Comment must be 2000 characters or fewer." });
  } else if (comment && /[<>]/.test(comment)) {
    issues.push({ field: "comment", message: "HTML is not allowed." });
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      productId,
      customerName,
      rating: rating as number,
      ...(comment ? { comment } : {}),
    },
  };
}
