import type { OrderStatus } from "@/lib/contracts/storefront";
import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { mapAdminOrder } from "@/lib/server/admin-data";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set<OrderStatus>(["whatsapp_initiated", "contacted", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { id } = await context.params;
  if (!UUID.test(id)) return apiError(400, "INVALID_ID", "معرّف الطلب غير صالح.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات الحالة غير صالحة."); }
  if (!isRecord(body) || typeof body.status !== "string" || !STATUSES.has(body.status as OrderStatus)) {
    return apiError(400, "INVALID_STATUS", "حالة الطلب غير صالحة.", "status");
  }
  try {
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.rpc("admin_change_order_status", { p_order_id: id, p_status: body.status, p_actor_id: admin.userId });
    if (error) {
      const conflict = ["INVALID_STATUS_TRANSITION", "OUT_OF_STOCK", "ORDER_NOT_FOUND", "VARIANT_UNAVAILABLE", "ORDER_TERMINAL"].some((code) => error.message.includes(code));
      return apiError(conflict ? 409 : 503, conflict ? "ORDER_UPDATE_CONFLICT" : "ORDER_UPDATE_FAILED", conflict ? "تعذر تغيير الحالة لأن المخزون أو حالة الطلب تغيّرت." : "تعذر تحديث الطلب الآن.");
    }
    const { data, error: readError } = await supabase.from("orders").select("*,items:order_items(*)").eq("id", id).single();
    if (readError || !data) return apiError(503, "ORDER_UPDATE_FAILED", "تم تحديث الطلب لكن تعذر تحميله الآن.");
    return apiJson({ item: mapAdminOrder(data) });
  } catch { return apiError(503, "ORDER_UPDATE_FAILED", "تعذر تحديث الطلب الآن."); }
}
