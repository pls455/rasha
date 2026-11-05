import { getActiveAdmin } from "@/lib/server/supabase/client";
import { apiError } from "@/lib/server/http";

export async function requireAdmin() {
  try {
    const admin = await getActiveAdmin();
    return admin ? { admin, response: null } : {
      admin: null,
      response: apiError(401, "ADMIN_REQUIRED", "يجب تسجيل الدخول بحساب المدير."),
    };
  } catch {
    return {
      admin: null,
      response: apiError(503, "AUTH_UNAVAILABLE", "تعذر التحقق من جلسة الإدارة الآن."),
    };
  }
}
