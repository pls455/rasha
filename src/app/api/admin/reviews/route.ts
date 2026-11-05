import { apiError, apiJson, readBoundedInteger } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const STATUSES = new Set(["pending", "approved", "rejected"]);

export async function GET(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const params = new URL(request.url).searchParams;
  const status = params.get("status") ?? "pending";
  if (!STATUSES.has(status)) return apiError(400, "INVALID_STATUS", "حالة التقييم غير صالحة.", "status");
  const page = readBoundedInteger(params.get("page"), 1, 1, 100000);
  const pageSize = readBoundedInteger(params.get("pageSize"), 25, 1, 100);
  try {
    const { data, error, count } = await createSupabaseServiceClient().from("reviews")
      .select("id,product_id,customer_name,rating,comment,status,created_at,updated_at,product:products!inner(name)", { count: "exact" })
      .eq("status", status).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) return apiError(503, "REVIEWS_UNAVAILABLE", "تعذر تحميل التقييمات الآن.");
    const items = (data ?? []).map((row) => {
      const product = Array.isArray(row.product) ? row.product[0] : row.product;
      return {
        id: row.id, productId: row.product_id, productName: product?.name ?? "",
        customerName: row.customer_name, rating: row.rating, comment: row.comment,
        createdAt: row.created_at, status: row.status, updatedAt: row.updated_at,
      };
    });
    const total = count ?? 0;
    return apiJson({ items, pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch { return apiError(503, "REVIEWS_UNAVAILABLE", "تعذر تحميل التقييمات الآن."); }
}
