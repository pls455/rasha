import type {
  ApiError,
  CategoriesResponse,
  Category,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateReviewRequest,
  CreateReviewResponse,
  HomeResponse,
  Product,
  ProductListQuery,
  ProductsResponse,
  StorefrontSettingsResponse,
} from "@/lib/contracts/storefront";

export class StorefrontApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "StorefrontApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new StorefrontApiError("تعذّر الاتصال بالمتجر. تحقق من اتصالك وحاول مجدداً.", 0, "network_error");
  }

  if (!response.ok) {
    let message = "تعذّر إكمال الطلب الآن. حاول مرة أخرى بعد قليل.";
    let code: string | undefined;
    try {
      const body = (await response.json()) as ApiError;
      message = body.error?.message || message;
      code = body.error?.code;
    } catch {
      // The server may return an empty or non-JSON error response.
    }
    throw new StorefrontApiError(message, response.status, code);
  }
  return (await response.json()) as T;
}

export async function getProducts(query: ProductListQuery = {}): Promise<ProductsResponse> {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.productType) params.set("productType", query.productType);
  if (query.categorySlug) params.set("categorySlug", query.categorySlug);
  if (query.brandId) params.set("brandId", query.brandId);
  if (query.scentFamily) params.set("scentFamily", query.scentFamily);
  if (query.sort) params.set("sort", query.sort);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const suffix = params.size ? `?${params.toString()}` : "";
  return request<ProductsResponse>(`/api/storefront/products${suffix}`);
}

export async function getProduct(slug: string): Promise<Product> {
  const encoded = encodeURIComponent(slug);
  const response = await request<{ item: Product }>(`/api/storefront/products/${encoded}`);
  return response.item;
}

export async function getCategories(): Promise<Category[]> {
  const response = await request<CategoriesResponse>("/api/storefront/categories");
  return response.items;
}

export function getHome(): Promise<HomeResponse> {
  return request<HomeResponse>("/api/storefront/home");
}

export function getStorefrontSettings(): Promise<StorefrontSettingsResponse> {
  return request<StorefrontSettingsResponse>("/api/storefront/settings");
}

export function createReview(input: CreateReviewRequest): Promise<CreateReviewResponse> {
  return request<CreateReviewResponse>("/api/reviews", { method: "POST", body: JSON.stringify(input) });
}

export function createOrder(input: CreateOrderRequest): Promise<CreateOrderResponse> {
  return request<CreateOrderResponse>("/api/orders", { method: "POST", body: JSON.stringify(input) });
}
