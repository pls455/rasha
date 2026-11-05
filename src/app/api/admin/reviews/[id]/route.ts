import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف التقييم غير صالح.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات التقييم غير صالحة."); }
  if (!isRecord(body) || (body.status !== "approved" && body.status !== "rejected")) return apiError(400, "INVALID_STATUS", "اختر الموافقة أو الرفض.", "status");
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.rpc("admin_set_review_status", { p_review_id: id, p_status: body.status, p_actor_id: admin.userId });
    if (error) return apiError(error.message.includes("REVIEW_NOT_FOUND") ? 404 : 503, "REVIEW_UPDATE_FAILED", "تعذر تحديث التقييم الآن.");
    const { data, error: readError } = await supabase.from("reviews")
      .select("id,product_id,customer_name,rating,comment,status,created_at,updated_at,product:products!inner(name)").eq("id", id).single();
    if (readError || !data) return apiError(503, "REVIEW_UPDATE_FAILED", "تم تحديث التقييم لكن تعذر تحميله الآن.");
    const product = Array.isArray(data.product) ? data.product[0] : data.product;
    return apiJson({ item: {
      id: data.id, productId: data.product_id, productName: product?.name ?? "",
      customerName: data.customer_name, rating: data.rating, comment: data.comment,
      createdAt: data.created_at, status: data.status, updatedAt: data.updated_at,
    } });
  } catch { return apiError(503, "REVIEW_UPDATE_FAILED", "تعذر تحديث التقييم الآن."); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف التقييم غير صالح.");
  try {
    const { data, error } = await createSupabaseServiceClient().rpc("admin_delete_review", { p_review_id: id, p_actor_id: admin.userId });
    if (error) return apiError(error.message.includes("REVIEW_NOT_FOUND") ? 404 : 503, "REVIEW_DELETE_FAILED", "تعذر حذف التقييم الآن.");
    if (data !== true) return apiError(503, "REVIEW_DELETE_FAILED", "تعذر تأكيد حذف التقييم.");
    return apiJson({ deleted: true });
  } catch { return apiError(503, "REVIEW_DELETE_FAILED", "تعذر حذف التقييم الآن."); }
}
