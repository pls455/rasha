import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف الماركة غير صالح.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات الماركة غير صالحة."); }
  if (!isRecord(body) || typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 120
    || (body.description !== undefined && body.description !== null && (typeof body.description !== "string" || body.description.length > 3000))
    || (body.logoUrl !== undefined && body.logoUrl !== null && (typeof body.logoUrl !== "string" || !/^https:\/\//.test(body.logoUrl)))
    || (body.isActive !== undefined && typeof body.isActive !== "boolean")) return apiError(400, "INVALID_BRAND", "تحقق من بيانات الماركة.");
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.rpc("admin_upsert_brand", { p_payload: { ...body, id }, p_actor_id: admin.userId });
    if (error) return apiError(error.message.includes("BRAND_NOT_FOUND") ? 404 : 409, "BRAND_SAVE_FAILED", "تعذر حفظ الماركة الآن.");
    const { data, error: readError } = await supabase.from("brands").select("id,name,description,logo_url,is_active").eq("id", id).single();
    if (readError || !data) return apiError(503, "BRAND_SAVE_FAILED", "تعذر تحميل الماركة الآن.");
    return apiJson({ item: { id: data.id, name: data.name, description: data.description, logoUrl: data.logo_url, isActive: data.is_active } });
  } catch { return apiError(503, "BRAND_SAVE_FAILED", "تعذر حفظ الماركة الآن."); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف الماركة غير صالح.");
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("admin_set_brand_active", { p_brand_id: id, p_is_active: false, p_actor_id: admin.userId });
    if (error || !data) return apiError(error?.message.includes("BRAND_NOT_FOUND") ? 404 : 503, "BRAND_DISABLE_FAILED", "تعذر إخفاء الماركة الآن.");
    return apiJson({ item: { id: data.id, name: data.name, description: data.description, logoUrl: data.logo_url, isActive: data.is_active } });
  } catch { return apiError(503, "BRAND_DISABLE_FAILED", "تعذر إخفاء الماركة الآن."); }
}
