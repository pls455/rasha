import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف القسم غير صالح.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات القسم غير صالحة."); }
  if (!isRecord(body) || typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 120
    || typeof body.slug !== "string" || !SLUG.test(body.slug)
    || (body.description !== undefined && body.description !== null && (typeof body.description !== "string" || body.description.length > 3000))
    || (body.imageUrl !== undefined && body.imageUrl !== null && (typeof body.imageUrl !== "string" || !/^https:\/\//.test(body.imageUrl)))
    || (body.isActive !== undefined && typeof body.isActive !== "boolean")
    || (body.displayOrder !== undefined && (!Number.isSafeInteger(body.displayOrder) || (body.displayOrder as number) < 0))) return apiError(400, "INVALID_CATEGORY", "تحقق من بيانات القسم.");
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.rpc("admin_upsert_category", { p_payload: { ...body, id }, p_actor_id: admin.userId });
    if (error) return apiError(error.message.includes("CATEGORY_NOT_FOUND") ? 404 : 409, "CATEGORY_SAVE_FAILED", "تعذر حفظ القسم الآن.");
    const { data, error: readError } = await supabase.from("categories").select("id,name,slug,description,image_url,is_active,display_order").eq("id", id).single();
    if (readError || !data) return apiError(503, "CATEGORY_SAVE_FAILED", "تعذر تحميل القسم الآن.");
    return apiJson({ item: { id: data.id, name: data.name, slug: data.slug, description: data.description, imageUrl: data.image_url, isActive: data.is_active, displayOrder: data.display_order } });
  } catch { return apiError(503, "CATEGORY_SAVE_FAILED", "تعذر حفظ القسم الآن."); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف القسم غير صالح.");
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("admin_set_category_active", { p_category_id: id, p_is_active: false, p_actor_id: admin.userId });
    if (error || !data) return apiError(error?.message.includes("CATEGORY_NOT_FOUND") ? 404 : 503, "CATEGORY_DISABLE_FAILED", "تعذر إخفاء القسم الآن.");
    return apiJson({ item: { id: data.id, name: data.name, slug: data.slug, description: data.description, imageUrl: data.image_url, isActive: data.is_active, displayOrder: data.display_order } });
  } catch { return apiError(503, "CATEGORY_DISABLE_FAILED", "تعذر إخفاء القسم الآن."); }
}
