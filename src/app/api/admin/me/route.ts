import { apiJson } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  return apiJson({ userId: admin.userId, displayName: admin.displayName });
}
