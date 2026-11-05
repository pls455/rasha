import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { apiError, apiJson, enforceRateLimit, readLimitedRequestBytes } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_KINDS = new Set(["products/original", "products/blended", "banners", "categories", "branding"]);
const REQUIRED_R2_ENV = ["R2_ACCOUNT_ID", "R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BASE_URL"] as const;

function hasValidImageSignature(bytes: Uint8Array): boolean {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return jpeg || png || webp;
}

function missingR2Configuration(): string[] {
  return REQUIRED_R2_ENV.filter((key) => !process.env[key]);
}

export async function POST(request: Request) {
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("multipart/form-data")) {
    return apiError(415, "MULTIPART_REQUIRED", "ارفع الصورة بصيغة نموذج ملفات.");
  }
  if (missingR2Configuration().length > 0) {
    return apiError(503, "IMAGE_STORAGE_NOT_CONFIGURED", "رفع الصور غير متاح حتى إعداد مساحة الصور.");
  }
  try {
    if (!await enforceRateLimit(request, `upload:${admin.userId}`, 30, 3600)) {
      return apiError(429, "RATE_LIMITED", "وصلت لحد رفع الصور؛ حاول لاحقًا.");
    }
  } catch {
    return apiError(503, "UPLOAD_UNAVAILABLE", "تعذر رفع الصورة الآن.");
  }
  const boundedBody = await readLimitedRequestBytes(request, MAX_UPLOAD_BYTES + 64 * 1024);
  if (boundedBody.response) return boundedBody.response;
  let form: FormData;
  try {
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    const bodyArrayBuffer = new ArrayBuffer(boundedBody.bytes.byteLength);
    new Uint8Array(bodyArrayBuffer).set(boundedBody.bytes);
    const boundedRequest = new Request(request.url, { method: "POST", headers, body: bodyArrayBuffer });
    form = await boundedRequest.formData();
  } catch {
    return apiError(400, "INVALID_UPLOAD", "تعذر قراءة الملف المرفق.");
  }
  const file = form.get("file");
  const kind = form.get("kind");
  if (!(file instanceof File) || typeof kind !== "string" || !ALLOWED_KINDS.has(kind)) {
    return apiError(400, "INVALID_UPLOAD", "الملف أو مجلد الصورة غير صالح.");
  }
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    return apiError(413, "FILE_TOO_LARGE", "حجم الصورة يجب ألا يتجاوز 8 ميغابايت.");
  }
  const input = new Uint8Array(await file.arrayBuffer());
  if (!hasValidImageSignature(input)) {
    return apiError(415, "INVALID_IMAGE_TYPE", "الملف ليس JPEG أو PNG أو WebP صالحًا.");
  }
  let output: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: 64_000_000, failOn: "error" });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 10000 || metadata.height > 10000) {
      return apiError(400, "INVALID_IMAGE_DIMENSIONS", "أبعاد الصورة غير صالحة.");
    }
    output = await image.rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 }).toBuffer();
  } catch {
    return apiError(415, "INVALID_IMAGE", "تعذر قراءة الصورة؛ جرّب ملف صورة آخر.");
  }

  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET_NAME!;
  const key = `rasha/${kind}/${randomUUID()}.webp`;
  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: output,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }));
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL!.replace(/\/+$/, "");
    return apiJson({
      imageUrl: `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`,
      objectKey: key,
      contentType: "image/webp",
      sizeBytes: output.byteLength,
    }, { status: 201 });
  } catch {
    return apiError(502, "UPLOAD_FAILED", "تعذر حفظ الصورة. لم نضفها إلى بيانات المنتج.");
  }
}
