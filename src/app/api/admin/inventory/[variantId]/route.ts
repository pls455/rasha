import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ variantId: string }> }) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const { variantId } = await context.params;
  if (!UUID.test(variantId)) return apiError(400, "INVALID_ID", "معرّف الحجم غير صالح.");
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات تعديل المخزون غير صالحة."); }
  if (!isRecord(body) || !Number.isSafeInteger(body.quantityChange) || (body.quantityChange as number) === 0
    || Math.abs(body.quantityChange as number) > 1000000 || typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 500) {
    return apiError(400, "INVALID_ADJUSTMENT", "أدخل كمية تغيير وسببًا واضحًا.");
  }
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.rpc("admin_adjust_inventory", {
      p_variant_id: variantId,
      p_quantity_change: body.quantityChange,
      p_reason: body.reason.trim(),
      p_actor_id: admin.userId,
    });
    if (error) {
      const conflict = error.message.includes("OUT_OF_STOCK") || error.message.includes("VARIANT_NOT_FOUND");
      return apiError(conflict ? 409 : 503, conflict ? "INVENTORY_CONFLICT" : "INVENTORY_UPDATE_FAILED", conflict ? "الكمية لم تعد متاحة أو الحجم غير موجود." : "تعذر تعديل المخزون الآن.");
    }
    if (!isRecord(data) || !isRecord(data.variant) || !isRecord(data.log)) return apiError(503, "INVENTORY_UPDATE_FAILED", "تم تعديل المخزون لكن تعذر تحميل الحركة.");
    const variant = data.variant;
    const { data: product, error: productError } = await supabase.from("products").select("name,product_type").eq("id", variant.product_id).single();
    if (productError || !product) return apiError(503, "INVENTORY_UPDATE_FAILED", "تم تعديل المخزون لكن تعذر تحميل تفاصيل المنتج.");
    return apiJson({
      variant: {
        variantId: variant.id, productId: variant.product_id, productName: product.name, productType: product.product_type,
        sizeLabel: variant.size_label, price: String(variant.price), stockQuantity: variant.stock_quantity,
        lowStockThreshold: variant.low_stock_threshold, isActive: variant.is_active, updatedAt: variant.updated_at,
      },
      log: {
        id: data.log.id, variantId: data.log.variant_id, changeType: data.log.change_type,
        quantityChange: data.log.quantity_change, previousQuantity: data.log.previous_quantity,
        newQuantity: data.log.new_quantity, reason: data.log.reason, orderId: data.log.order_id,
        createdBy: data.log.created_by, createdAt: data.log.created_at,
      },
    });
  } catch { return apiError(503, "INVENTORY_UPDATE_FAILED", "تعذر تعديل المخزون الآن."); }
}
