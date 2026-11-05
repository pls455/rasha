import { apiError, apiJson, readBoundedInteger } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { mapAdminOrder } from "@/lib/server/admin-data";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const STATUSES = new Set(["whatsapp_initiated", "contacted", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function dateBound(value: string | null, endOfDay = false): string | null {
  if (!value) return null;
  const normalized = DATE_ONLY.test(value) ? `${value}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}` : value;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export async function GET(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const search = params.get("q")?.trim() ?? "";
  const from = params.get("from");
  const to = params.get("to");
  if (status && !STATUSES.has(status)) return apiError(400, "INVALID_STATUS", "حالة الطلب غير صالحة.", "status");
  if (search.length > 100) return apiError(400, "SEARCH_TOO_LONG", "عبارة البحث طويلة أكثر من اللازم.", "q");
  const fromTimestamp = dateBound(from);
  const toTimestamp = dateBound(to, true);
  if (from && !fromTimestamp) return apiError(400, "INVALID_DATE", "تاريخ البداية غير صالح.", "from");
  if (to && !toTimestamp) return apiError(400, "INVALID_DATE", "تاريخ النهاية غير صالح.", "to");
  if (fromTimestamp && toTimestamp && Date.parse(fromTimestamp) > Date.parse(toTimestamp)) return apiError(400, "INVALID_DATE_RANGE", "تاريخ البداية بعد تاريخ النهاية.");
  const page = readBoundedInteger(params.get("page"), 1, 1, 100000);
  const pageSize = readBoundedInteger(params.get("pageSize"), 25, 1, 100);
  try {
    const supabase = createSupabaseServiceClient();
    const { data: result, error } = await supabase.rpc("admin_search_orders", {
      p_search: search,
      p_status: status ?? null,
      p_from: fromTimestamp,
      p_to: toTimestamp,
      p_page: page,
      p_page_size: pageSize,
      p_actor_id: admin.userId,
    });
    if (error) return apiError(503, "ORDERS_UNAVAILABLE", "تعذر تحميل الطلبات الآن.");
    const resultRow = Array.isArray(result) ? result[0] : result;
    const ids: string[] = resultRow && Array.isArray(resultRow.order_ids) ? resultRow.order_ids : [];
    const total = Number(resultRow?.total_count ?? 0);
    if (!ids.length) return apiJson({ items: [], pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
    const { data, error: readError } = await supabase.from("orders").select("*,items:order_items(*)").in("id", ids);
    if (readError) return apiError(503, "ORDERS_UNAVAILABLE", "تعذر تحميل تفاصيل الطلبات الآن.");
    const positions = new Map(ids.map((id, index) => [id, index]));
    const items = (data ?? []).map(mapAdminOrder).sort((a, b) => (positions.get(a.id) ?? 0) - (positions.get(b.id) ?? 0));
    return apiJson({ items, pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch { return apiError(503, "ORDERS_UNAVAILABLE", "تعذر تحميل الطلبات الآن."); }
}
