import { apiError, apiJson, readBoundedInteger } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
interface InventoryRow {
  variant_id: string;
  product_id: string;
  product_name: string;
  product_type: "original" | "blended";
  size_label: string;
  price: string | number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  updated_at: string;
  total_count: number | string;
}

export async function GET(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  const params = new URL(request.url).searchParams;
  const lowStock = params.get("lowStock") === "true";
  const page = readBoundedInteger(params.get("page"), 1, 1, 100000);
  const pageSize = readBoundedInteger(params.get("pageSize"), 25, 1, 100);
  try {
    const { data, error } = await createSupabaseServiceClient().rpc("admin_list_inventory", {
      p_actor_id: admin.userId, p_low_stock: lowStock, p_page: page, p_page_size: pageSize,
    });
    if (error) return apiError(503, "INVENTORY_UNAVAILABLE", "تعذر تحميل المخزون الآن.");
    const rows = (data ?? []) as InventoryRow[];
    const items = rows.map((row) => ({
      variantId: row.variant_id,
      productId: row.product_id,
      productName: row.product_name,
      productType: row.product_type,
      sizeLabel: row.size_label,
      price: String(row.price),
      stockQuantity: row.stock_quantity,
      lowStockThreshold: row.low_stock_threshold,
      isActive: row.is_active,
      updatedAt: row.updated_at,
    }));
    const total = Number(rows[0]?.total_count ?? 0);
    return apiJson({ items, pagination: { page, pageSize, total, hasMore: page * pageSize < total } });
  } catch { return apiError(503, "INVENTORY_UNAVAILABLE", "تعذر تحميل المخزون الآن."); }
}
