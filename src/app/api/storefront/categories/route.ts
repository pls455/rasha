import { apiError, apiJson } from "@/lib/server/http";
import { getCategories } from "@/lib/server/storefront";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return apiJson({ items: await getCategories() });
  } catch {
    return apiError(503, "STORE_UNAVAILABLE", "تعذر تحميل الأقسام الآن.");
  }
}
