import { apiError, apiJson, enforceRateLimit, isRecord, readLimitedJson } from "@/lib/server/http";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return apiError(415, "JSON_REQUIRED", "أرسل التقييم بصيغة JSON.");
  try {
    if (!await enforceRateLimit(request, "guest-review", 5, 3600)) return apiError(429, "RATE_LIMITED", "وصلت لعدد كبير من التقييمات؛ حاول بعد ساعة.");
  } catch { return apiError(503, "REVIEWS_UNAVAILABLE", "تعذر إرسال التقييم الآن."); }
  const parsedBody = await readLimitedJson(request, 16 * 1024);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.value;
  if (!isRecord(body) || typeof body.productId !== "string" || !UUID.test(body.productId)
    || typeof body.customerName !== "string" || body.customerName.trim().length < 1 || body.customerName.trim().length > 120
    || !Number.isSafeInteger(body.rating) || (body.rating as number) < 1 || (body.rating as number) > 5
    || body.comment !== undefined && body.comment !== null && (typeof body.comment !== "string" || body.comment.length > 2000)) {
    return apiError(400, "INVALID_REVIEW", "تحقق من المنتج والاسم والتقييم.");
  }
  const customerName = body.customerName.trim();
  const comment = typeof body.comment === "string" ? body.comment.trim() : null;
  if (/[<>]/.test(customerName) || (comment && /[<>]/.test(comment))) {
    return apiError(400, "HTML_NOT_ALLOWED", "اكتب التقييم كنص عادي من دون HTML.");
  }
  try {
    const { data, error } = await createSupabaseServiceClient().rpc("create_guest_review", {
      p_product_id: body.productId,
      p_customer_name: customerName,
      p_rating: body.rating,
      p_comment: comment,
    });
    if (error) return apiError(error.message.includes("PRODUCT_UNAVAILABLE") ? 404 : 400, "REVIEW_REJECTED", "تعذر تسجيل التقييم لهذا المنتج.");
    if (!isRecord(data) || typeof data.id !== "string") return apiError(503, "REVIEWS_UNAVAILABLE", "تعذر إكمال تسجيل التقييم.");
    return apiJson({ item: { id: data.id, status: "pending", createdAt: data.createdAt } }, { status: 201 });
  } catch { return apiError(503, "REVIEWS_UNAVAILABLE", "تعذر إرسال التقييم الآن."); }
}
