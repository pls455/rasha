import { createSupabaseServiceClient } from "@/lib/server/supabase/client";
import "server-only";
import type {
  Brand,
  Category,
  HomeResponse,
  Product,
  ProductType,
  ProductsResponse,
  ProductSort,
} from "@/lib/contracts/storefront";

interface DbRecord {
  [key: string]: unknown;
}

const asRecord = (value: unknown): DbRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as DbRecord : {};
const stringOrNull = (value: unknown): string | null => typeof value === "string" ? value : null;
const stringValue = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const numberValue = (value: unknown, fallback = 0): number => typeof value === "number" ? value : Number.isFinite(Number(value)) ? Number(value) : fallback;
const boolValue = (value: unknown): boolean => value === true;
const arrayValue = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const objectValue = (value: unknown): Record<string, unknown> => {
  const row = asRecord(value);
  return row;
};

function mapBrand(value: unknown): Brand | null {
  const row = asRecord(value);
  if (!row.id || !row.name || row.is_active === false) return null;
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    description: stringOrNull(row.description),
    logoUrl: stringOrNull(row.logo_url),
    isActive: row.is_active !== false,
  };
}

function mapCategory(value: unknown): Category | null {
  const row = asRecord(value);
  if (!row.id || !row.name || !row.slug || row.is_active !== true) return null;
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    slug: stringValue(row.slug),
    description: stringOrNull(row.description),
    imageUrl: stringOrNull(row.image_url),
    isActive: boolValue(row.is_active),
    displayOrder: numberValue(row.display_order),
  };
}

export function mapProduct(value: unknown): Product {
  const row = asRecord(value);
  const productType = row.product_type === "original" ? "original" : "blended";
  const images = arrayValue(row.images).map((image) => {
    const item = asRecord(image);
    return {
      id: stringValue(item.id),
      imageUrl: stringValue(item.image_url),
      altText: stringOrNull(item.alt_text),
      displayOrder: numberValue(item.display_order),
      isPrimary: boolValue(item.is_primary),
    };
  }).filter((image) => image.id && image.imageUrl).sort((a, b) => a.displayOrder - b.displayOrder);
  const variants = arrayValue(row.variants).map((variant) => {
    const item = asRecord(variant);
    return {
      id: stringValue(item.id),
      productId: stringValue(item.product_id),
      sizeLabel: stringValue(item.size_label),
      price: stringValue(item.price, "0.00"),
      compareAtPrice: stringOrNull(item.compare_at_price),
      stockQuantity: numberValue(item.stock_quantity),
      isActive: boolValue(item.is_active),
    };
  }).filter((variant) => variant.id && variant.isActive).sort((a, b) => a.sizeLabel.localeCompare(b.sizeLabel, "ar"));
  return {
    id: stringValue(row.id),
    name: stringValue(row.name),
    slug: stringValue(row.slug),
    description: stringOrNull(row.description),
    productType: productType as ProductType,
    originCountry: stringOrNull(row.origin_country),
    brand: mapBrand(row.brand),
    category: mapCategory(row.category),
    scentFamily: stringOrNull(row.scent_family),
    notes: arrayValue(row.notes).filter((note): note is string => typeof note === "string"),
    isFeatured: boolValue(row.is_featured),
    isBestSeller: boolValue(row.is_best_seller),
    displayOrder: numberValue(row.display_order),
    createdAt: stringValue(row.created_at),
    images,
    variants,
  };
}

const PRODUCT_SELECT = `
  id,name,slug,description,product_type,brand_id,category_id,scent_family,notes,origin_country,
  is_featured,is_best_seller,display_order,created_at,
  brand:brands(id,name,description,logo_url,is_active),
  category:categories(id,name,slug,description,image_url,is_active,display_order),
  images:product_images(id,image_url,alt_text,display_order,is_primary),
  variants:product_variants!inner(id,product_id,size_label,price,compare_at_price,stock_quantity,is_active)
`;

export interface ProductQueryInput {
  search?: string;
  productType?: ProductType;
  categorySlug?: string;
  brandId?: string;
  scentFamily?: string;
  sort: ProductSort;
  page: number;
  pageSize: number;
}

async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("id", ids)
    .eq("is_published", true)
    .eq("variants.is_active", true);
  if (error) throw new Error("PRODUCTS_READ_FAILED");
  const mapped = (data ?? []).map(mapProduct).filter((product) => product.id && product.variants.length > 0);
  const order = new Map(ids.map((id, index) => [id, index]));
  return mapped.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

export async function getProducts(query: ProductQueryInput): Promise<ProductsResponse> {
  const supabase = createSupabaseServiceClient();
  const [{ data: pageResult, error: pageError }, { data: facetData, error: facetError }] = await Promise.all([
    supabase.rpc("search_storefront_products", {
      p_search: query.search || null,
      p_product_type: query.productType || null,
      p_category_slug: query.categorySlug || null,
      p_brand_id: query.brandId || null,
      p_scent_family: query.scentFamily || null,
      p_sort: query.sort,
      p_page: query.page,
      p_page_size: query.pageSize,
    }),
    supabase.rpc("storefront_product_facets", {
      p_search: query.search || null,
      p_product_type: query.productType || null,
      p_category_slug: query.categorySlug || null,
    }),
  ]);
  if (pageError || facetError) throw new Error("PRODUCTS_READ_FAILED");
  const resultRow = Array.isArray(pageResult) ? asRecord(pageResult[0]) : asRecord(pageResult);
  const ids = arrayValue(resultRow.product_ids).filter((id): id is string => typeof id === "string");
  const total = numberValue(resultRow.total_count);
  const items = await getProductsByIds(ids);
  const facets = asRecord(facetData);
  const brands = arrayValue(facets.brands).map(mapBrand).filter((brand): brand is Brand => brand !== null);
  const scentFamilies = arrayValue(facets.scentFamilies).filter((name): name is string => typeof name === "string");
  return {
    items,
    pagination: { page: query.page, pageSize: query.pageSize, total, hasMore: query.page * query.pageSize < total },
    facets: { brands, scentFamilies },
  };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("variants.is_active", true)
    .maybeSingle();
  if (error) throw new Error("PRODUCT_READ_FAILED");
  if (!data) return null;
  const product = mapProduct(data);
  return product.variants.length > 0 ? product : null;
}

export async function getCategories(): Promise<Category[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("categories")
    .select("id,name,slug,description,image_url,is_active,display_order")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error("CATEGORIES_READ_FAILED");
  return (data ?? []).map(mapCategory).filter((category): category is Category => category !== null);
}

function mapHomeSetting(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function getHomeContent(): Promise<HomeResponse> {
  const supabase = createSupabaseServiceClient();
  const [settingsResult, bannersResult, sectionsResult, reviewsResult] = await Promise.all([
    supabase.from("site_settings").select("key,value").eq("is_public", true).in("key", ["home_hero", "promo_bar"]),
    supabase.from("banners").select("id,title,description,image_url,link_url,display_order").eq("is_active", true).order("display_order", { ascending: true }),
    supabase.from("site_sections").select("id,section_key,title,description,display_order,settings,section_products:site_section_products(product_id,display_order)").eq("is_active", true).order("display_order", { ascending: true }),
    supabase.from("reviews").select("id,product_id,customer_name,rating,comment,created_at").eq("status", "approved").order("created_at", { ascending: false }).limit(12),
  ]);
  if (settingsResult.error || bannersResult.error || sectionsResult.error || reviewsResult.error) throw new Error("HOME_READ_FAILED");

  const settings = new Map<string, Record<string, unknown>>();
  for (const row of settingsResult.data ?? []) {
    const value = mapHomeSetting(row.value);
    if (value) settings.set(row.key, value);
  }
  const rawHero = settings.get("home_hero");
  const hero = rawHero && (rawHero.isActive !== false || rawHero.isActive === undefined) ? {
    title: stringOrNull(rawHero.title),
    description: stringOrNull(rawHero.description),
    imageUrl: stringOrNull(rawHero.imageUrl),
    ctaLabel: stringOrNull(rawHero.ctaLabel),
    ctaUrl: stringOrNull(rawHero.ctaUrl),
  } : null;
  const rawPromo = settings.get("promo_bar");
  const promoBar = rawPromo && rawPromo.isActive !== false && typeof rawPromo.text === "string" && rawPromo.text.trim() ? {
    text: rawPromo.text,
    linkUrl: stringOrNull(rawPromo.linkUrl),
  } : null;

  const rawSections = sectionsResult.data ?? [];
  const sectionLinkRows = rawSections.map((row) => ({
    row,
    links: arrayValue(row.section_products).map((link) => asRecord(link)).sort((a, b) => numberValue(a.display_order) - numberValue(b.display_order)),
  }));
  const allProductIds = [...new Set(sectionLinkRows.flatMap(({ links }) => links.map((link) => stringValue(link.product_id)).filter(Boolean)))];
  const allProducts = await getProductsByIds(allProductIds);
  const productsById = new Map(allProducts.map((product) => [product.id, product]));
  const sections = sectionLinkRows.map(({ row, links }) => {
    const productIds = links.map((link) => stringValue(link.product_id)).filter((id) => productsById.has(id));
    const rawSettings = mapHomeSetting(row.settings) ?? {};
    return {
      id: row.id,
      sectionKey: row.section_key,
      title: row.title,
      description: row.description,
      displayOrder: numberValue(row.display_order),
      settings: rawSettings,
      productIds,
      products: productIds.map((id) => productsById.get(id)).filter((product): product is Product => product !== undefined),
    };
  });

  const reviewRows = reviewsResult.data ?? [];
  const reviewProductIds = [...new Set(reviewRows.map((row) => row.product_id))];
  const reviewProducts = await getProductsByIds(reviewProductIds);
  const reviewProductNames = new Map(reviewProducts.map((product) => [product.id, product.name]));
  const reviews = reviewRows.filter((row) => reviewProductNames.has(row.product_id)).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productName: reviewProductNames.get(row.product_id) ?? "",
    customerName: row.customer_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  }));

  return {
    hero,
    promoBar,
    banners: (bannersResult.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.image_url,
      linkUrl: row.link_url,
      displayOrder: row.display_order,
    })),
    sections,
    reviews,
  };
}
