import type { ProductSort, ProductType } from "@/lib/contracts/storefront";
import { apiError, apiJson, readBoundedInteger } from "@/lib/server/http";
import { getProducts } from "@/lib/server/storefront";

export const dynamic = "force-dynamic";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const productTypeRaw = params.get("productType");
  if (productTypeRaw && productTypeRaw !== "original" && productTypeRaw !== "blended") {
    return apiError(400, "INVALID_PRODUCT_TYPE", "نوع المنتج غير صالح.", "productType");
  }
  const sortRaw = params.get("sort") ?? "newest";
  if (sortRaw !== "newest" && sortRaw !== "price_asc" && sortRaw !== "price_desc") {
    return apiError(400, "INVALID_SORT", "ترتيب المنتجات غير صالح.", "sort");
  }
  const categorySlug = params.get("categorySlug") || undefined;
  if (categorySlug && (categorySlug.length > 120 || !SLUG_PATTERN.test(categorySlug))) {
    return apiError(400, "INVALID_CATEGORY", "القسم المطلوب غير صالح.", "categorySlug");
  }
  const brandId = params.get("brandId") || undefined;
  if (brandId && !UUID_PATTERN.test(brandId)) return apiError(400, "INVALID_BRAND", "الماركة المطلوبة غير صالحة.", "brandId");
  const search = params.get("search")?.trim() || undefined;
  const scentFamily = params.get("scentFamily")?.trim() || undefined;
  if ((search?.length ?? 0) > 100 || (scentFamily?.length ?? 0) > 100) {
    return apiError(400, "FILTER_TOO_LONG", "قيمة البحث أو التصفية طويلة أكثر من اللازم.");
  }

  try {
    const result = await getProducts({
      search,
      productType: productTypeRaw as ProductType | undefined,
      categorySlug,
      brandId,
      scentFamily,
      sort: sortRaw as ProductSort,
      page: readBoundedInteger(params.get("page"), 1, 1, 100000),
      pageSize: readBoundedInteger(params.get("pageSize"), 24, 1, 48),
    });
    return apiJson(result);
  } catch {
    return apiError(503, "STORE_UNAVAILABLE", "تعذر تحميل المنتجات الآن.");
  }
}
