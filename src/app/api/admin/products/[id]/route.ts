import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { mapAdminProduct } from "@/lib/server/admin-data";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";
import { validateProduct } from "@/lib/server/product-validation";

export const dynamic = "force-dynamic";
const SELECT = `id,name,slug,description,product_type,brand_id,category_id,scent_family,notes,origin_country,is_published,is_featured,is_best_seller,display_order,created_at,brand:brands(id,name,description,logo_url,is_active),category:categories(id,name,slug,description,image_url,is_active,display_order),images:product_images(id,image_url,alt_text,display_order,is_primary),variants:product_variants(id,product_id,size_label,price,compare_at_price,stock_quantity,low_stock_threshold,is_active)`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getItem(id: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("products").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error("PRODUCT_READ_FAILED");
  return data ? mapAdminProduct(data) : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف المنتج غير صالح.");
  try {
    const item = await getItem(id);
    return item ? apiJson({ item }) : apiError(404, "PRODUCT_NOT_FOUND", "المنتج غير موجود.");
  } catch { return apiError(503, "PRODUCT_READ_FAILED", "تعذر تحميل المنتج الآن."); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف المنتج غير صالح.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات المنتج غير صالحة."); }
  if (!isRecord(body)) return apiError(400, "INVALID_PRODUCT", "بيانات المنتج غير صالحة.");
  const validation = validateProduct(body);
  if (!validation.ok) return apiError(400, "INVALID_PRODUCT", validation.message, validation.field);
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("admin_upsert_product", { p_payload: { ...validation.value, id }, p_actor_id: admin.userId });
    if (error) return apiError(409, "PRODUCT_SAVE_FAILED", "تعذر حفظ المنتج؛ راجع بياناته والأسعار.");
    const item = await getItem(String(data));
    return item ? apiJson({ item }) : apiError(503, "PRODUCT_SAVE_FAILED", "حُفظ المنتج لكن تعذر تحميله الآن.");
  } catch { return apiError(503, "PRODUCT_SAVE_FAILED", "تعذر حفظ المنتج الآن."); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف المنتج غير صالح.");
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.rpc("admin_delete_product", { p_product_id: id, p_actor_id: admin.userId });
    if (error) return apiError(error.message.includes("PRODUCT_NOT_FOUND") ? 404 : 503, "PRODUCT_DELETE_FAILED", "تعذر إخفاء المنتج الآن.");
    const item = await getItem(id);
    return item ? apiJson({ item }) : apiError(503, "PRODUCT_DELETE_FAILED", "تعذر تحميل المنتج الآن.");
  } catch { return apiError(503, "PRODUCT_DELETE_FAILED", "تعذر إخفاء المنتج الآن."); }
}
