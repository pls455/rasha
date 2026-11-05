import { apiError, apiJson, readBoundedInteger } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const params = new URL(request.url).searchParams;
  const variantId = params.get("variantId");
  if (variantId && !UUID.test(variantId)) return apiError(400, "INVALID_ID", "معرّف الحجم غير صالح.");
  const page = readBoundedInteger(params.get("page"), 1, 1, 100000);
  const pageSize = readBoundedInteger(params.get("pageSize"), 25, 1, 100);
  try {
    let query = createSupabaseServiceClient().from("inventory_logs").select("id,variant_id,change_type,quantity_change,previous_quantity,new_quantity,reason,order_id,created_by,created_at", { count: "exact" });
    if (variantId) query = query.eq("variant_id", variantId);
    const { data, error, count } = await query.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) return apiError(503, "INVENTORY_LOGS_UNAVAILABLE", "تعذر تحميل سجل المخزون الآن.");
    const items = (data ?? []).map((row) => ({
      id: row.id, variantId: row.variant_id, changeType: row.change_type, quantityChange: row.quantity_change,
      previousQuantity: row.previous_quantity, newQuantity: row.new_quantity, reason: row.reason,
      orderId: row.order_id, createdBy: row.created_by, createdAt: row.created_at,
    }));
    const total = count ?? 0;
    return apiJson({ items, pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch { return apiError(503, "INVENTORY_LOGS_UNAVAILABLE", "تعذر تحميل سجل المخزون الآن."); }
}
