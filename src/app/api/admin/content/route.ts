import type { AdminContentUpdateRequest } from "@/lib/contracts/admin";
import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { getAdminContent } from "@/lib/server/admin-content";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[a-z0-9_]{1,80}$/;
const isNullableText = (value: unknown, max: number) => value === null || value === undefined || typeof value === "string" && value.length <= max;
const isHttpsOrNull = (value: unknown) => value === null || value === undefined || typeof value === "string" && value.length <= 2048 && /^https:\/\//i.test(value);

function validateContent(value: unknown): value is AdminContentUpdateRequest {
  if (!isRecord(value) || !Array.isArray(value.banners) || !Array.isArray(value.sections) || value.banners.length > 30 || value.sections.length > 30) return false;
  if (value.hero !== null && (!isRecord(value.hero) || !isNullableText(value.hero.title, 180) || !isNullableText(value.hero.description, 2000)
    || !isHttpsOrNull(value.hero.imageUrl) || !isNullableText(value.hero.ctaLabel, 80) || !isHttpsOrNull(value.hero.ctaUrl) || typeof value.hero.isActive !== "boolean")) return false;
  if (value.promoBar !== null && (!isRecord(value.promoBar) || typeof value.promoBar.text !== "string" || value.promoBar.text.trim().length < 1 || value.promoBar.text.length > 500 || !isHttpsOrNull(value.promoBar.linkUrl) || typeof value.promoBar.isActive !== "boolean")) return false;
  for (const banner of value.banners) {
    if (!isRecord(banner) || banner.id !== undefined && (typeof banner.id !== "string" || !UUID.test(banner.id))
      || typeof banner.title !== "string" || banner.title.trim().length < 1 || banner.title.length > 180
      || !isNullableText(banner.description, 2000) || !isHttpsOrNull(banner.imageUrl) || typeof banner.imageUrl !== "string"
      || !isHttpsOrNull(banner.linkUrl) || typeof banner.isActive !== "boolean"
      || !Number.isSafeInteger(banner.displayOrder) || (banner.displayOrder as number) < 0) return false;
  }
  for (const section of value.sections) {
    if (!isRecord(section) || section.id !== undefined && (typeof section.id !== "string" || !UUID.test(section.id))
      || typeof section.sectionKey !== "string" || !KEY.test(section.sectionKey)
      || typeof section.title !== "string" || section.title.trim().length < 1 || section.title.length > 180
      || !isNullableText(section.description, 2000) || typeof section.isActive !== "boolean"
      || !Number.isSafeInteger(section.displayOrder) || (section.displayOrder as number) < 0
      || !isRecord(section.settings) || !Array.isArray(section.productIds) || section.productIds.length > 40
      || section.settings.imageUrl !== undefined && !isHttpsOrNull(section.settings.imageUrl)
      || JSON.stringify(section.settings).length > 16000
      || section.productIds.some((id) => typeof id !== "string" || !UUID.test(id))
      || new Set(section.productIds).size !== section.productIds.length) return false;
  }
  return true;
}

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  try { return apiJson({ item: await getAdminContent() }); }
  catch { return apiError(503, "CONTENT_UNAVAILABLE", "تعذر تحميل محتوى المتجر الآن."); }
}

export async function PATCH(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "محتوى الصفحة غير صالح."); }
  if (!validateContent(body)) return apiError(400, "INVALID_CONTENT", "تحقق من البانرات والأقسام والروابط وترتيبها.");
  try {
    const { error } = await createSupabaseServiceClient().rpc("admin_update_content", { p_payload: body, p_actor_id: admin.userId });
    if (error) return apiError(409, "CONTENT_UPDATE_FAILED", "تعذر حفظ محتوى المتجر؛ تحقق من المنتجات المرتبطة.");
    return apiJson({ item: await getAdminContent() });
  } catch { return apiError(503, "CONTENT_UPDATE_FAILED", "تعذر حفظ محتوى المتجر الآن."); }
}
