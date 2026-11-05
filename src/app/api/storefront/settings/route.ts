import { apiError, apiJson, isRecord } from "@/lib/server/http";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.from("site_settings").select("key,value").eq("is_public", true)
      .in("key", ["store_public_config", "store_whatsapp_number"]);
    if (error) return apiError(503, "STORE_SETTINGS_UNAVAILABLE", "تعذر تحميل إعدادات المتجر الآن.");
    const values = new Map((data ?? []).map((row) => [row.key, row.value]));
    const config = values.get("store_public_config");
    const phoneRecord = values.get("store_whatsapp_number");
    const publicConfig = isRecord(config) ? config : {};
    const publicPhone = isRecord(phoneRecord) ? phoneRecord.number : null;
    const policiesRaw = publicConfig.policies;
    const policies = isRecord(policiesRaw)
      ? Object.fromEntries(Object.entries(policiesRaw).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
      : {};
    const contactRaw = isRecord(publicConfig.contactInfo) ? publicConfig.contactInfo : {};
    return apiJson({
      storeName: typeof publicConfig.storeName === "string" ? publicConfig.storeName : "رَشّة | RASHA",
      whatsappNumber: typeof publicPhone === "string" ? publicPhone : process.env.STORE_WHATSAPP_NUMBER ?? "",
      policies,
      contactInfo: {
        phone: typeof contactRaw.phone === "string" ? contactRaw.phone : null,
        email: typeof contactRaw.email === "string" ? contactRaw.email : null,
        address: typeof contactRaw.address === "string" ? contactRaw.address : null,
      },
    });
  } catch { return apiError(503, "STORE_SETTINGS_UNAVAILABLE", "تعذر تحميل إعدادات المتجر الآن."); }
}
