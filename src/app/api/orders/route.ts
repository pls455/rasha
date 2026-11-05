import { validateCreateOrderRequest } from "@/lib/contracts/storefront";
import { missingOrderMessageTemplateTokens } from "@/lib/contracts/admin";
import { apiError, apiJson, enforceRateLimit, isRecord, readLimitedJson } from "@/lib/server/http";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";
const PHONE_DIGITS = /^\d{8,15}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_TYPE_AR: Record<string, string> = { original: "أصلي", blended: "تركيب" };
const DEFAULT_ORDER_TEMPLATE = "طلب جديد من متجر {storeName}\n\nرقم الطلب: {orderNumber}\n\nتفاصيل الطلب:\n{items}\n\nإجمالي المنتجات: {subtotal} ₪\n{deliveryNote}\nيرجى التواصل لتأكيد الطلب.";

function mapCheckoutError(message: string) {
  if (message.includes("OUT_OF_STOCK")) return apiError(409, "OUT_OF_STOCK", "إحدى الكميات لم تعد متوفرة. حدّث السلة وحاول مرة أخرى.");
  if (message.includes("PRODUCT_UNAVAILABLE")) return apiError(409, "PRODUCT_UNAVAILABLE", "أحد المنتجات لم يعد متاحًا. حدّث السلة وحاول مرة أخرى.");
  if (message.includes("IDEMPOTENCY_CONFLICT")) return apiError(409, "IDEMPOTENCY_CONFLICT", "مفتاح الطلب استُخدم سابقًا لمحتوى مختلف. حدّث الصفحة وحاول مجددًا.");
  if (message.includes("ORDER_ALREADY_PROCESSED")) return apiError(409, "ORDER_ALREADY_PROCESSED", "هذا الطلب عولج مسبقًا؛ ابدأ طلبًا جديدًا إذا أردت المتابعة.");
  if (message.includes("INVALID_ITEMS") || message.includes("DUPLICATE_VARIANT") || message.includes("INVALID_IDEMPOTENCY_KEY") || message.includes("FIELD_TOO_LONG")) {
    return apiError(400, "INVALID_ORDER", "بيانات الطلب غير صالحة. راجع السلة وحاول مرة أخرى.");
  }
  return apiError(503, "ORDER_UNAVAILABLE", "تعذر حفظ الطلب الآن؛ لم نفتح واتساب ولم نفرّغ السلة.");
}

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return apiError(415, "JSON_REQUIRED", "أرسل الطلب بصيغة JSON.");
  }
  try {
    if (!await enforceRateLimit(request, "guest-order", 12, 60)) {
      return apiError(429, "RATE_LIMITED", "وصلت لعدد كبير من المحاولات؛ انتظر دقيقة ثم حاول مرة أخرى.");
    }
  } catch {
    return apiError(503, "ORDER_UNAVAILABLE", "تعذر حفظ الطلب الآن؛ لم نفتح واتساب ولم نفرّغ السلة.");
  }
  const parsedBody = await readLimitedJson(request, 64 * 1024);
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.value;
  const validation = validateCreateOrderRequest(body);
  if (!validation.ok) {
    const first = validation.issues[0];
    return apiError(400, "INVALID_ORDER", first?.message ?? "بيانات الطلب غير صالحة.", first?.field);
  }
  const order = validation.value;
  if (order.items.length > 50 || order.idempotencyKey.length > 128 || order.items.some((item) => !UUID_PATTERN.test(item.variantId) || item.quantity > 9999)) {
    return apiError(400, "INVALID_ORDER", "بيانات الطلب غير صالحة.");
  }
  if (new Set(order.items.map((item) => item.variantId)).size !== order.items.length) {
    return apiError(400, "DUPLICATE_VARIANT", "يوجد حجم مكرر في الطلب؛ حدّث السلة وحاول مرة أخرى.");
  }
  if (order.customerPhone && !PHONE_DIGITS.test(order.customerPhone.replace(/[ +()-]/g, ""))) {
    return apiError(400, "INVALID_PHONE", "رقم الهاتف غير صالح.", "customerPhone");
  }

  const supabase = createSupabaseServiceClient();
  const { data: settingRows, error: settingsError } = await supabase.from("site_settings")
    .select("key,value,is_public")
    .in("key", ["store_whatsapp_number", "store_public_config", "store_config"]);
  if (settingsError) return apiError(503, "STORE_CONTACT_UNAVAILABLE", "تعذر تحميل إعدادات المتجر؛ لم نحفظ الطلب.");
  const settings = new Map((settingRows ?? []).map((row) => [row.key, row.value]));
  const publicConfig = isRecord(settings.get("store_public_config")) ? settings.get("store_public_config") as Record<string, unknown> : {};
  const privateConfig = isRecord(settings.get("store_config")) ? settings.get("store_config") as Record<string, unknown> : {};
  const storeName = typeof publicConfig.storeName === "string" ? publicConfig.storeName : "رَشّة | RASHA";
  const orderMessageTemplate = typeof privateConfig.orderMessageTemplate === "string" ? privateConfig.orderMessageTemplate : DEFAULT_ORDER_TEMPLATE;
  if (missingOrderMessageTemplateTokens(orderMessageTemplate).length > 0) {
    return apiError(503, "ORDER_TEMPLATE_INVALID", "قالب رسالة الطلب غير مكتمل؛ لم نحفظ الطلب.");
  }
  const publicPhoneRow = (settingRows ?? []).find((row) => row.key === "store_whatsapp_number");
  const storedNumber = publicPhoneRow?.is_public === true && isRecord(publicPhoneRow.value) ? publicPhoneRow.value.number : null;
  const configuredNumber = typeof storedNumber === "string" ? storedNumber : process.env.STORE_WHATSAPP_NUMBER;
  const whatsappNumber = configuredNumber?.replace(/\D/g, "") ?? "";
  if (!/^\d{8,15}$/.test(whatsappNumber)) {
    return apiError(503, "STORE_CONTACT_UNAVAILABLE", "تعذر إعداد رقم واتساب المتجر؛ لم نحفظ الطلب.");
  }
  const { data, error } = await supabase.rpc("create_guest_order", {
    p_items: order.items,
    p_idempotency_key: order.idempotencyKey,
    p_customer_name: order.customerName ?? null,
    p_customer_phone: order.customerPhone?.replace(/[ +()-]/g, "") ?? null,
    p_notes: order.notes ?? null,
  });
  if (error) return mapCheckoutError(error.message);
  if (!isRecord(data) || typeof data.orderId !== "string" || typeof data.orderNumber !== "string" || !Array.isArray(data.items)) {
    return apiError(503, "ORDER_UNAVAILABLE", "تعذر إكمال إنشاء الطلب الآن.");
  }

  const items = data.items.filter(isRecord).map((item) => ({
    productName: typeof item.productName === "string" ? item.productName : "",
    productType: item.productType === "original" ? "original" : "blended",
    variantName: typeof item.variantName === "string" ? item.variantName : "",
    quantity: typeof item.quantity === "number" ? item.quantity : Number(item.quantity),
    unitPrice: typeof item.unitPrice === "string" ? item.unitPrice : String(item.unitPrice ?? "0.00"),
    lineTotal: typeof item.lineTotal === "string" ? item.lineTotal : String(item.lineTotal ?? "0.00"),
  }));
  const itemsText = items.map((item) => `- ${item.productName} (${PRODUCT_TYPE_AR[item.productType]}) - ${item.variantName} × ${item.quantity} - ${item.unitPrice} ₪ للوحدة - ${item.lineTotal} ₪`).join("\n");
  const deliveryNote = "ملاحظة: تكلفة التوصيل يتم تحديدها عبر واتساب.";
  const templateValues: Record<string, string> = {
    "{storeName}": storeName,
    "{orderNumber}": data.orderNumber,
    "{items}": itemsText,
    "{subtotal}": String(data.subtotal),
    "{deliveryNote}": deliveryNote,
  };
  const message = Object.entries(templateValues).reduce((current, [token, value]) => current.split(token).join(value), orderMessageTemplate);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  return apiJson({
    orderId: data.orderId,
    orderNumber: data.orderNumber,
    status: "whatsapp_initiated",
    subtotal: String(data.subtotal),
    currency: "ILS",
    deliveryCost: null,
    items,
    whatsappUrl,
  });
}
