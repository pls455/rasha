import type {
  ApprovedReviewSummary,
  Brand,
  Category,
  CurrencyCode,
  DecimalString,
  HomeBanner,
  HomeHero,
  HomePromoBar,
  HomeSection,
  OrderStatus,
  Product,
  ProductType,
  ProductVariant,
  StorefrontContactInfo,
  ValidationResult,
} from "./storefront";

export interface AdminMe {
  userId: string;
  displayName: string | null;
}

export interface AdminDashboardResponse {
  stats: {
    totalProducts: number;
    publishedProducts: number;
    availableProducts: number;
    lowStockVariants: number;
    ordersByStatus: Record<OrderStatus, number>;
    confirmedSubtotal: DecimalString;
    deliveredSubtotal: DecimalString;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    confirmedQuantity: number;
  }>;
}

export interface AdminProductVariant extends ProductVariant {
  lowStockThreshold: number;
}

export interface AdminProduct extends Omit<Product, "variants"> {
  brandId: string | null;
  categoryId: string | null;
  isPublished: boolean;
  variants: AdminProductVariant[];
}

export interface AdminProductUpsertRequest {
  name: string;
  slug: string;
  description: string | null;
  productType: ProductType;
  brandId: string | null;
  categoryId: string | null;
  scentFamily: string | null;
  notes: string[];
  originCountry: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  displayOrder: number;
  variants: Array<{
    id?: string;
    sizeLabel: string;
    price: DecimalString;
    compareAtPrice: DecimalString | null;
    stockQuantity: number;
    lowStockThreshold: number;
    isActive: boolean;
  }>;
  images: Array<{
    id?: string;
    imageUrl: string;
    altText: string | null;
    displayOrder: number;
    isPrimary: boolean;
  }>;
}

export type AdminProductsResponse = {
  items: AdminProduct[];
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
};

export type AdminProductResponse = { item: AdminProduct };

export interface AdminOrderItem {
  productId: string | null;
  variantId: string | null;
  productNameSnapshot: string;
  productTypeSnapshot: ProductType;
  variantNameSnapshot: string;
  unitPriceSnapshot: DecimalString;
  quantity: number;
  lineTotal: DecimalString;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: DecimalString;
  currency: CurrencyCode;
  deliveryCost: DecimalString | null;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  items: AdminOrderItem[];
}

export type AdminOrdersResponse = {
  items: AdminOrder[];
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
};

export interface AdminOrdersQuery {
  q?: string;
  status?: OrderStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type AdminOrderResponse = { item: AdminOrder };
export interface AdminOrderStatusUpdateRequest { status: OrderStatus }

export interface AdminInventoryItem {
  variantId: string;
  productId: string;
  productName: string;
  productType: ProductType;
  sizeLabel: string;
  price: DecimalString;
  stockQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  updatedAt: string;
}

export interface AdminInventoryLog {
  id: string;
  variantId: string | null;
  changeType: "order_confirmed" | "order_cancelled" | "manual_adjustment";
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  orderId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AdminInventoryResponse {
  items: AdminInventoryItem[];
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
}

export interface AdminInventoryUpdateRequest {
  quantityChange: number;
  reason: string;
}

export interface AdminInventoryUpdateResponse {
  variant: AdminInventoryItem;
  log: AdminInventoryLog;
}

export interface AdminReview extends ApprovedReviewSummary {
  status: "pending" | "approved" | "rejected";
  updatedAt: string;
}

export interface AdminReviewsResponse {
  items: AdminReview[];
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
}

export interface AdminReviewUpdateRequest {
  status: "approved" | "rejected";
}

export type AdminReviewResponse = { item: AdminReview };
export interface AdminReviewDeleteResponse { deleted: true }
export type AdminAdminBrandsResponse = { items: Brand[] };
export type AdminCategoriesResponse = { items: Category[] };

export type AdminContentBanner = HomeBanner & { isActive: boolean };
export type AdminContentSection = HomeSection & { isActive: boolean };
export type AdminPromoBar = HomePromoBar & { isActive: boolean };
export type AdminContentHero = HomeHero & { isActive: boolean };
export type AdminContentBannerInput = Omit<HomeBanner, "id"> & { id?: string; isActive: boolean };
export type AdminContentSectionInput = Omit<HomeSection, "id" | "products"> & { id?: string; isActive: boolean };

export interface AdminContentUpdateRequest {
  hero: AdminContentHero | null;
  promoBar: AdminPromoBar | null;
  banners: AdminContentBannerInput[];
  sections: AdminContentSectionInput[];
}

export interface AdminContentData {
  hero: AdminContentHero | null;
  promoBar: AdminPromoBar | null;
  banners: AdminContentBanner[];
  sections: AdminContentSection[];
}

export type AdminContentResponse = { item: AdminContentData };

export interface AdminSettings {
  storeName: string;
  whatsappNumber: string;
  lowStockThreshold: number;
  policies: Record<string, string>;
  orderMessageTemplate: string;
  contactInfo: StorefrontContactInfo;
}

export type AdminSettingsResponse = { item: AdminSettings };
export type AdminSettingsUpdateRequest = AdminSettings;

export interface AdminLog {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminLogsResponse {
  items: AdminLog[];
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
}

export type AdminAssetKind = "products/original" | "products/blended" | "banners" | "categories" | "branding";

/** Multipart body; the server verifies the real file type and stores a compressed WebP. */
export interface AdminUploadRequest {
  file: File;
  kind: AdminAssetKind;
}

export interface AdminUploadResponse {
  imageUrl: string;
  objectKey: string;
  contentType: "image/webp";
  sizeBytes: number;
}

export const ORDER_MESSAGE_TEMPLATE_REQUIRED_TOKENS = [
  "{storeName}",
  "{orderNumber}",
  "{items}",
  "{subtotal}",
  "{deliveryNote}",
] as const;

export function missingOrderMessageTemplateTokens(template: string): string[] {
  return ORDER_MESSAGE_TEMPLATE_REQUIRED_TOKENS.filter((token) => !template.includes(token));
}

export type AdminApiResult<T> = ValidationResult<T>;
