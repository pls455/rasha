import type { ApiError } from "@/lib/contracts/storefront";

export class AdminApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
  }
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const isMultipart = typeof FormData !== "undefined" && init?.body instanceof FormData;
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { Accept: "application/json", ...(init?.body && !isMultipart ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new AdminApiError("تعذّر الاتصال بلوحة المتجر. حاول مرة أخرى.", 0, "network_error");
  }
  if (!response.ok) {
    let message = "تعذّر إكمال العملية. حاول مرة أخرى.";
    let code: string | undefined;
    try {
      const body = (await response.json()) as ApiError;
      message = body.error?.message || message;
      code = body.error?.code;
    } catch { /* The response may be empty. */ }
    throw new AdminApiError(message, response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export function adminGet<T>(path: string) { return adminRequest<T>(path); }
export function adminPost<T>(path: string, payload: unknown) { return adminRequest<T>(path, { method: "POST", body: JSON.stringify(payload) }); }
export function adminPatch<T>(path: string, payload: unknown) { return adminRequest<T>(path, { method: "PATCH", body: JSON.stringify(payload) }); }
export function adminDelete<T>(path: string) { return adminRequest<T>(path, { method: "DELETE" }); }
export function adminUpload<T>(file: File, kind: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);
  return adminRequest<T>("/api/admin/uploads", { method: "POST", body });
}
