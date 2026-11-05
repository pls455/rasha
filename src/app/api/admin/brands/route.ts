import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  try {
    const { data, error } = await createSupabaseServiceClient().from("brands")
      .select("id,name,description,logo_url,is_active").order("name", { ascending: true });
    if (error) return apiError(503, "BRANDS_UNAVAILABLE", "تعذر تحميل الماركات الآن.");
    return apiJson({ items: (data ?? []).map((row) => ({ id: row.id, name: row.name, description: row.description, logoUrl: row.logo_url, isActive: row.is_active })) });
  } catch { return apiError(503, "BRANDS_UNAVAILABLE", "تعذر تحميل الماركات الآن."); }
}

export async function POST(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات الماركة غير صالحة."); }
  if (!isRecord(body) || typeof body.name !== "string" || body.name.trim().length < 1 || body.name.trim().length > 120
    || (body.description !== undefined && body.description !== null && (typeof body.description !== "string" || body.description.length > 3000))
    || (body.logoUrl !== undefined && body.logoUrl !== null && (typeof body.logoUrl !== "string" || !/^https:\/\//.test(body.logoUrl)))
    || (body.isActive !== undefined && typeof body.isActive !== "boolean")) {
    return apiError(400, "INVALID_BRAND", "تحقق من اسم الماركة ووصفها وصورتها.");
  }
  try {
    const supabase = createSupabaseServiceClient();
    const { data: id, error } = await supabase.rpc("admin_upsert_brand", { p_payload: body, p_actor_id: admin.userId });
    if (error) return apiError(409, "BRAND_SAVE_FAILED", "تعذر حفظ الماركة الآن.");
    const { data, error: readError } = await supabase.from("brands").select("id,name,description,logo_url,is_active").eq("id", id).single();
    if (readError || !data) return apiError(503, "BRAND_SAVE_FAILED", "حُفظت الماركة لكن تعذر تحميلها الآن.");
    return apiJson({ item: { id: data.id, name: data.name, description: data.description, logoUrl: data.logo_url, isActive: data.is_active } }, { status: 201 });
  } catch { return apiError(503, "BRAND_SAVE_FAILED", "تعذر حفظ الماركة الآن."); }
}
