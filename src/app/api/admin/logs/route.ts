import { apiError, apiJson, readBoundedInteger } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const params = new URL(request.url).searchParams;
  const page = readBoundedInteger(params.get("page"), 1, 1, 100000);
  const pageSize = readBoundedInteger(params.get("pageSize"), 25, 1, 100);
  try {
    const { data, error, count } = await createSupabaseServiceClient().from("admin_logs")
      .select("id,actor_id,action,entity_type,entity_id,old_values,new_values,created_at", { count: "exact" })
      .order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) return apiError(503, "ADMIN_LOGS_UNAVAILABLE", "تعذر تحميل سجل الإدارة الآن.");
    const items = (data ?? []).map((row) => ({
      id: row.id, actorId: row.actor_id, action: row.action, entityType: row.entity_type,
      entityId: row.entity_id, oldValues: row.old_values, newValues: row.new_values, createdAt: row.created_at,
    }));
    const total = count ?? 0;
    return apiJson({ items, pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch { return apiError(503, "ADMIN_LOGS_UNAVAILABLE", "تعذر تحميل سجل الإدارة الآن."); }
}
