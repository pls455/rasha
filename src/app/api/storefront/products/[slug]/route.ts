import { apiError, apiJson } from "@/lib/server/http";
import { getProductBySlug } from "@/lib/server/storefront";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!slug || slug.length > 160) return apiError(400, "INVALID_SLUG", "رابط المنتج غير صالح.");
  try {
    const item = await getProductBySlug(slug);
    return item ? apiJson({ item }) : apiError(404, "PRODUCT_NOT_FOUND", "لم نعثر على هذا العطر.");
  } catch {
    return apiError(503, "STORE_UNAVAILABLE", "تعذر تحميل المنتج الآن.");
  }
}
