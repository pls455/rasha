import type { AdminDashboardResponse } from "@/lib/contracts/admin";
import { apiError, apiJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const STATUSES = ["whatsapp_initiated", "contacted", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  try {
    const { data, error } = await createSupabaseServiceClient().rpc("admin_dashboard_summary", { p_actor_id: admin.userId });
    if (error || !data || typeof data !== "object") return apiError(503, "DASHBOARD_UNAVAILABLE", "تعذر تحميل الإحصاءات الآن.");
    const result = data as Record<string, unknown>;
    const stats = (result.stats && typeof result.stats === "object" ? result.stats : {}) as Record<string, unknown>;
    const rawOrders = (stats.ordersByStatus && typeof stats.ordersByStatus === "object" ? stats.ordersByStatus : {}) as Record<string, unknown>;
    const responseBody: AdminDashboardResponse = {
      stats: {
        totalProducts: Number(stats.totalProducts ?? 0),
        publishedProducts: Number(stats.publishedProducts ?? 0),
        availableProducts: Number(stats.availableProducts ?? 0),
        lowStockVariants: Number(stats.lowStockVariants ?? 0),
        ordersByStatus: Object.fromEntries(STATUSES.map((status) => [status, Number(rawOrders[status] ?? 0)])) as AdminDashboardResponse["stats"]["ordersByStatus"],
        confirmedSubtotal: String(stats.confirmedSubtotal ?? "0.00"),
        deliveredSubtotal: String(stats.deliveredSubtotal ?? "0.00"),
      },
      topProducts: Array.isArray(result.topProducts) ? result.topProducts.map((item) => {
        const row = item as Record<string, unknown>;
        return { productId: String(row.productId), productName: String(row.productName), confirmedQuantity: Number(row.confirmedQuantity ?? 0) };
      }) : [],
    };
    return apiJson(responseBody);
  } catch { return apiError(503, "DASHBOARD_UNAVAILABLE", "تعذر تحميل الإحصاءات الآن."); }
}
