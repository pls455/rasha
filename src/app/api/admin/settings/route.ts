import type { AdminSettings } from "@/lib/contracts/admin";
import { missingOrderMessageTemplateTokens } from "@/lib/contracts/admin";
import type { StorefrontContactInfo } from "@/lib/contracts/storefront";
import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const PHONE = /^\d{8,15}$/;
const DEFAULT_ORDER_TEMPLATE = "طلب جديد من متجر {storeName}\n\nرقم الطلب: {orderNumber}\n\nتفاصيل الطلب:\n{items}\n\nإجمالي المنتجات: {subtotal} ₪\n{deliveryNote}\nيرجى التواصل لتأكيد الطلب.";
const toRecord = (value: unknown): Record<string, unknown> => isRecord(value) ? value : {};
const nullableString = (value: unknown, fallback: string | null): string | null => typeof value === "string" ? value : fallback;

async function readSettings(): Promise<AdminSettings> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("site_settings").select("key,value").in("key", ["store_config", "store_whatsapp_number"]);
  if (error) throw new Error("SETTINGS_READ_FAILED");
  const values = new Map((data ?? []).map((row) => [row.key, toRecord(row.value)]));
  const config = values.get("store_config") ?? {};
  const phoneValue = values.get("store_whatsapp_number")?.number;
  const whatsappNumber = typeof phoneValue === "string" ? phoneValue : process.env.STORE_WHATSAPP_NUMBER ?? "";
  const policiesRaw = config.policies;
  const policies = isRecord(policiesRaw) ? Object.fromEntries(Object.entries(policiesRaw).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};
  const contact = toRecord(config.contactInfo);
  const contactInfo: StorefrontContactInfo = {
    phone: nullableString(contact.phone, null),
    email: nullableString(contact.email, null),
    address: nullableString(contact.address, null),
  };
  return {
    storeName: typeof config.storeName === "string" ? config.storeName : "رَشّة | RASHA",
    whatsappNumber,
    lowStockThreshold: Number.isSafeInteger(config.lowStockThreshold) ? Number(config.lowStockThreshold) : 5,
    policies,
    orderMessageTemplate: typeof config.orderMessageTemplate === "string" ? config.orderMessageTemplate : DEFAULT_ORDER_TEMPLATE,
    contactInfo,
  };
}

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  try { return apiJson({ item: await readSettings() }); }
  catch { return apiError(503, "SETTINGS_UNAVAILABLE", "تعذر تحميل إعدادات المتجر الآن."); }
}

export async function PATCH(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  let body: unknown;
  try { body = await request.json(); } catch { return apiError(400, "INVALID_JSON", "بيانات الإعدادات غير صالحة."); }
  const contactInfo = isRecord(body) && isRecord(body.contactInfo) ? body.contactInfo : {};
  if (!isRecord(body) || typeof body.storeName !== "string" || body.storeName.trim().length < 1 || body.storeName.length > 180
    || typeof body.whatsappNumber !== "string" || !PHONE.test(body.whatsappNumber)
    || !Number.isSafeInteger(body.lowStockThreshold) || (body.lowStockThreshold as number) < 0 || (body.lowStockThreshold as number) > 100000
    || typeof body.orderMessageTemplate !== "string" || body.orderMessageTemplate.length > 5000
    || missingOrderMessageTemplateTokens(body.orderMessageTemplate).length > 0
    || !isRecord(body.contactInfo)
    || !["phone", "email", "address"].every((key) => contactInfo[key] === null || typeof contactInfo[key] === "string")
    || typeof contactInfo.phone === "string" && contactInfo.phone.length > 40
    || typeof contactInfo.email === "string" && contactInfo.email.length > 254
    || typeof contactInfo.address === "string" && contactInfo.address.length > 500
    || !isRecord(body.policies) || Object.entries(body.policies).length > 30
    || Object.entries(body.policies).some(([key, value]) => !/^[a-zA-Z0-9_-]{1,80}$/.test(key) || typeof value !== "string" || value.length > 8000)) {
    return apiError(400, "INVALID_SETTINGS", "تحقق من اسم المتجر والتواصل والقالب والسياسات.");
  }
  try {
    const payload = {
      storeName: body.storeName.trim(),
      whatsappNumber: body.whatsappNumber,
      lowStockThreshold: body.lowStockThreshold,
      policies: body.policies,
      orderMessageTemplate: body.orderMessageTemplate,
      contactInfo,
    };
    const { error } = await createSupabaseServiceClient().rpc("admin_update_store_settings", { p_payload: payload, p_actor_id: admin.userId });
    if (error) return apiError(400, "SETTINGS_UPDATE_FAILED", "تعذر حفظ إعدادات المتجر.");
    return apiJson({ item: await readSettings() });
  } catch { return apiError(503, "SETTINGS_UPDATE_FAILED", "تعذر حفظ إعدادات المتجر الآن."); }
}
