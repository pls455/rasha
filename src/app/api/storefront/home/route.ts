import { apiError, apiJson } from "@/lib/server/http";
import { getHomeContent } from "@/lib/server/storefront";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return apiJson(await getHomeContent());
  } catch {
    return apiError(503, "STORE_UNAVAILABLE", "تعذر تحميل محتوى الصفحة الرئيسية الآن.");
  }
}
