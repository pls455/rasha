import type { AdminProductUpsertRequest } from "@/lib/contracts/admin";
import { isRecord } from "@/lib/server/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MONEY = /^\d{1,10}(?:\.\d{1,2})?$/;

export function validateProduct(value: unknown): { ok: true; value: AdminProductUpsertRequest } | { ok: false; message: string; field: string } {
  if (!isRecord(value)) return { ok: false, message: "يجب إرسال بيانات المنتج.", field: "body" };
  if (typeof value.name !== "string" || value.name.trim().length < 1 || value.name.trim().length > 180) return { ok: false, message: "اسم المنتج غير صالح.", field: "name" };
  if (typeof value.slug !== "string" || !SLUG.test(value.slug) || value.slug.length > 180) return { ok: false, message: "رابط المنتج غير صالح.", field: "slug" };
  if (value.productType !== "original" && value.productType !== "blended") return { ok: false, message: "نوع المنتج غير صالح.", field: "productType" };
  for (const field of ["brandId", "categoryId"] as const) {
    if (value[field] !== null && value[field] !== undefined && (typeof value[field] !== "string" || !UUID.test(value[field]))) return { ok: false, message: "المعرّف غير صالح.", field };
  }
  for (const field of ["isPublished", "isFeatured", "isBestSeller"] as const) {
    if (typeof value[field] !== "boolean") return { ok: false, message: "الحقل مطلوب.", field };
  }
  if (!Number.isSafeInteger(value.displayOrder) || (value.displayOrder as number) < 0) return { ok: false, message: "ترتيب العرض غير صالح.", field: "displayOrder" };
  if (value.description !== null && value.description !== undefined && (typeof value.description !== "string" || value.description.length > 10000)) return { ok: false, message: "الوصف غير صالح.", field: "description" };
  if (value.scentFamily !== null && value.scentFamily !== undefined && (typeof value.scentFamily !== "string" || value.scentFamily.length > 120)) return { ok: false, message: "العائلة العطرية غير صالحة.", field: "scentFamily" };
  if (value.originCountry !== null && value.originCountry !== undefined && (typeof value.originCountry !== "string" || value.originCountry.length > 120)) return { ok: false, message: "بلد المنشأ غير صالح.", field: "originCountry" };
  if (!Array.isArray(value.notes) || value.notes.length > 40 || value.notes.some((note) => typeof note !== "string" || note.length > 80)) return { ok: false, message: "النوتات غير صالحة.", field: "notes" };
  if (!Array.isArray(value.variants) || value.variants.length < 1 || value.variants.length > 100) return { ok: false, message: "أضف حجمًا واحدًا على الأقل.", field: "variants" };
  const variantLabels = new Set<string>();
  for (let index = 0; index < value.variants.length; index += 1) {
    const variant = value.variants[index];
    if (!isRecord(variant) || typeof variant.sizeLabel !== "string" || variant.sizeLabel.trim().length < 1 || variant.sizeLabel.length > 80
      || typeof variant.price !== "string" || !MONEY.test(variant.price)
      || (variant.compareAtPrice !== null && variant.compareAtPrice !== undefined && (typeof variant.compareAtPrice !== "string" || !MONEY.test(variant.compareAtPrice)))
      || !Number.isSafeInteger(variant.stockQuantity) || (variant.stockQuantity as number) < 0
      || !Number.isSafeInteger(variant.lowStockThreshold) || (variant.lowStockThreshold as number) < 0
      || typeof variant.isActive !== "boolean"
      || (variant.id !== undefined && (typeof variant.id !== "string" || !UUID.test(variant.id)))) {
      return { ok: false, message: "تحقق من الحجم والسعر والمخزون.", field: `variants.${index}` };
    }
    const label = variant.sizeLabel.trim().toLocaleLowerCase("ar");
    if (variantLabels.has(label)) return { ok: false, message: "لا تكرر الحجم نفسه.", field: `variants.${index}.sizeLabel` };
    variantLabels.add(label);
  }
  if (!Array.isArray(value.images) || value.images.length > 20) return { ok: false, message: "عدد الصور غير صالح.", field: "images" };
  for (let index = 0; index < value.images.length; index += 1) {
    const image = value.images[index];
    if (!isRecord(image) || typeof image.imageUrl !== "string" || image.imageUrl.length > 2048
      || !/^https:\/\//i.test(image.imageUrl) || !Number.isSafeInteger(image.displayOrder) || (image.displayOrder as number) < 0
      || typeof image.isPrimary !== "boolean" || (image.altText !== null && image.altText !== undefined && (typeof image.altText !== "string" || image.altText.length > 300))) {
      return { ok: false, message: "تحقق من رابط الصورة وترتيبها.", field: `images.${index}` };
    }
  }
  return { ok: true, value: value as unknown as AdminProductUpsertRequest };
}
