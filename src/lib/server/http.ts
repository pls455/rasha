import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

export function apiError(status: number, code: string, message: string, field?: string) {
  return NextResponse.json(
    { error: { code, message, ...(field ? { field } : {}) } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function apiJson<T>(body: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readBoundedInteger(value: string | null, fallback: number, minimum: number, maximum: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

export async function readLimitedRequestBytes(request: Request, maxBytes: number): Promise<{ bytes: Uint8Array; response: null } | { bytes: null; response: NextResponse }> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) return { bytes: null, response: apiError(400, "INVALID_CONTENT_LENGTH", "حجم الطلب غير صالح.") };
    if (parsedLength > maxBytes) return { bytes: null, response: apiError(413, "BODY_TOO_LARGE", "حجم البيانات أكبر من المسموح.") };
  }
  if (!request.body) return { bytes: new Uint8Array(), response: null };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { bytes: null, response: apiError(413, "BODY_TOO_LARGE", "حجم البيانات أكبر من المسموح.") };
      }
      chunks.push(value);
    }
  } catch {
    return { bytes: null, response: apiError(400, "BODY_READ_FAILED", "تعذر قراءة البيانات المرسلة.") };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return { bytes, response: null };
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<{ value: unknown; response: null } | { value: null; response: NextResponse }> {
  const result = await readLimitedRequestBytes(request, maxBytes);
  if (result.response) return { value: null, response: result.response };
  try {
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(result.bytes)) as unknown, response: null };
  } catch {
    return { value: null, response: apiError(400, "INVALID_JSON", "بيانات الطلب غير صالحة.") };
  }
}

export async function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  const rateKey = createHash("sha256").update(`rasha:${bucket}:${address}`).digest("hex");
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_rate_key: rateKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("RATE_LIMIT_UNAVAILABLE");
  return data === true;
}
