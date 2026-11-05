import type { AdminProductUpsertRequest } from "@/lib/contracts/admin";
import { apiError, apiJson, readBoundedInteger, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { mapAdminProduct } from "@/lib/server/admin-data";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const SELECT = `id,name,slug,description,product_type,brand_id,category_id,scent_family,notes,origin_country,is_published,is_featured,is_best_seller,display_order,created_at,brand:brands(id,name,description,logo_url,is_active),category:categories(id,name,slug,description,image_url,is_active,display_order),images:product_images(id,image_url,alt_text,display_order,is_primary),variants:product_variants(id,product_id,size_label,price,compare_at_price,stock_quantity,low_stock_threshold,is_active)`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONEY = /^\d{1,10}(?:\.\d{1,2})?$/;

function validateProduct(value: unknown): { ok: true; value: AdminProductUpsertRequest } | { ok: false; message: string; field: string } {
  if (!isRecord(value)) return { ok: false, message: "يجب إرسال بيانات المنتج.", field: "body" };
  if (typeof value.name !== "string" || value.name.trim().length < 1 || value.name.trim().length > 180) return { ok: false, message: "اسم المنتج غير صالح.", field: "name" };
  if (typeof value.slug !== "string" || !SLUG.test(value.slug) || value.slug.length > 180) return { ok: false, message: "رابط المنتج غير صالح.", field: "slug" };
  if (value.productType !== "original" && value.productType !== "blended") return { ok: false, message: "نوع المنتج غير صالح.", field: "productType" };
  for (const field of ["brandId", "categoryId"] as const) {
    if (value[field] !== null && value[field] !== undefined && (typeof value[field] !== "string" || !UUID.test(value[field]))) return { ok: false, message: "المعرّف غير صالح.", field };
  }
  for (const field of ["isPublished", "isFeatured", "isBestSeller"] as const) {
    if (typeof value[field] !== "boolean") return { ok: false, message: "الحقل مطلوب.", field };
  }
  if (!Number.isSafeInteger(value.displayOrder) || (value.displayOrder as number) < 0) return { ok: false, message: "ترتيب العرض غير صالح.", field: "displayOrder" };
  if (!Array.isArray(value.notes) || value.notes.length > 40 || value.notes.some((note) => typeof note !== "string" || note.length > 80)) return { ok: false, message: "النوتات غير صالحة.", field: "notes" };
  if (!Array.isArray(value.variants) || value.variants.length < 1 || value.variants.length > 100) return { ok: false, message: "أضف حجمًا واحدًا على الأقل.", field: "variants" };
  for (let index = 0; index < value.variants.length; index += 1) {
    const variant = value.variants[index];
    if (!isRecord(variant) || typeof variant.sizeLabel !== "string" || variant.sizeLabel.trim().length < 1 || variant.sizeLabel.length > 80
      || typeof variant.price !== "string" || !MONEY.test(variant.price)
      || (variant.compareAtPrice !== null && variant.compareAtPrice !== undefined && (typeof variant.compareAtPrice !== "string" || !MONEY.test(variant.compareAtPrice)))
      || !Number.isSafeInteger(variant.stockQuantity) || (variant.stockQuantity as number) < 0
      || !Number.isSafeInteger(variant.lowStockThreshold) || (variant.lowStockThreshold as number) < 0
      || typeof variant.isActive !== "boolean"
      || (variant.id !== undefined && (typeof variant.id !== "string" || !UUID.test(variant.id)))) {
      return { ok: false, message: "تحقق من الحجم والسعر والمخزون.", field: `variants.${index}` };
    }
  }
  if (!Array.isArray(value.images) || value.images.length > 20) return { ok: false, message: "عدد الصور غير صالح.", field: "images" };
  for (let index = 0; index < value.images.length; index += 1) {
    const image = value.images[index];
    if (!isRecord(image) || typeof image.imageUrl !== "string" || image.imageUrl.length > 2048
      || !/^https:\/\//i.test(image.imageUrl) || !Number.isSafeInteger(image.displayOrder) || (image.displayOrder as number) < 0
      || typeof image.isPrimary !== "boolean" || (image.altText !== null && image.altText !== undefined && typeof image.altText !== "string")) {
      return { ok: false, message: "تحقق من رابط الصورة وترتيبها.", field: `images.${index}` };
    }
  }
  return { ok: true, value: value as unknown as AdminProductUpsertRequest };
}

async function fetchAdminProducts(ids: string[]) {
  if (!ids.length) return [];
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("products").select(SELECT).in("id", ids);
  if (error) throw new Error("ADMIN_PRODUCTS_READ_FAILED");
  const mapped = (data ?? []).map(mapAdminProduct);
  const positions = new Map(ids.map((id, index) => [id, index]));
  return mapped.sort((a, b) => (positions.get(a.id) ?? 999999) - (positions.get(b.id) ?? 999999));
}

export async function GET(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const params = new URL(request.url).searchParams;
  const search = params.get("q")?.trim() ?? "";
  if (search.length > 100) return apiError(400, "SEARCH_TOO_LONG", "نص البحث طويل أكثر من اللازم.", "q");
  const page = readBoundedInteger(params.get("page"), 1, 1, 100000);
  const pageSize = readBoundedInteger(params.get("pageSize"), 24, 1, 100);
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("admin_search_products", {
      p_search: search,
      p_page: page,
      p_page_size: pageSize,
      p_actor_id: admin.userId,
    });
    if (error) return apiError(503, "ADMIN_PRODUCTS_UNAVAILABLE", "تعذر تحميل المنتجات الآن.");
    const row = Array.isArray(data) ? data[0] : data;
    const ids: string[] = row && Array.isArray(row.product_ids) ? row.product_ids : [];
    const total = Number(row?.total_count ?? 0);
    const items = await fetchAdminProducts(ids);
    return apiJson({ items, pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch {
    return apiError(503, "ADMIN_PRODUCTS_UNAVAILABLE", "تعذر تحميل المنتجات الآن.");
  }
}

export async function POST(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات المنتج غير صالحة."); }
  const validation = validateProduct(body);
  if (!validation.ok) return apiError(400, "INVALID_PRODUCT", validation.message, validation.field);
  try {
    const supabase = createSupabaseServiceClient();
    const { data: id, error } = await supabase.rpc("admin_upsert_product", { p_payload: validation.value, p_actor_id: admin.userId });
    if (error) {
      if (error.message.includes("INVALID_BRAND") || error.message.includes("INVALID_CATEGORY")) return apiError(400, "INVALID_REFERENCE", "الماركة أو القسم غير موجود.");
      return apiError(409, "PRODUCT_SAVE_FAILED", "تعذر حفظ المنتج؛ راجع الرابط والأحجام والأسعار.");
    }
    const [item] = await fetchAdminProducts([id]);
    return item ? apiJson({ item }, { status: 201 }) : apiError(503, "PRODUCT_SAVE_FAILED", "حُفظ المنتج لكن تعذر تحميله الآن.");
  } catch {
    return apiError(503, "PRODUCT_SAVE_FAILED", "تعذر حفظ المنتج الآن.");
  }
}
