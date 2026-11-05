"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { AdminAssetKind, AdminCategoriesResponse, AdminProduct, AdminProductResponse, AdminProductUpsertRequest, AdminProductsResponse, AdminSettingsResponse, AdminUploadResponse } from "@/lib/contracts/admin";
import type { Brand, Category, ProductType } from "@/lib/contracts/storefront";
import { AdminApiError, adminDelete, adminGet, adminPatch, adminPost, adminUpload } from "@/lib/admin-api";
import { formatIls } from "@/lib/money";
import { AdminError, AdminLoading } from "@/components/admin/AdminDashboardPanel";
import { AdminCatalogPanel } from "@/components/admin/AdminCatalogPanel";

const PAGE_SIZE = 12;
type ImageDraft = { id?: string; imageUrl: string; altText: string | null; displayOrder: number; isPrimary: boolean; key: string };
type VariantDraft = { id?: string; sizeLabel: string; price: string; compareAtPrice: string; stockQuantity: number; lowStockThreshold: number; isActive: boolean; key: string };
type ProductForm = { name: string; slug: string; description: string; productType: ProductType; brandId: string; categoryId: string; scentFamily: string; notes: string; originCountry: string; isPublished: boolean; isFeatured: boolean; isBestSeller: boolean; displayOrder: number; variants: VariantDraft[]; images: ImageDraft[] };

function makeKey() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function blankForm(defaultThreshold = 5): ProductForm { return { name: "", slug: "", description: "", productType: "original", brandId: "", categoryId: "", scentFamily: "", notes: "", originCountry: "", isPublished: false, isFeatured: false, isBestSeller: false, displayOrder: 0, variants: [{ sizeLabel: "", price: "", compareAtPrice: "", stockQuantity: 0, lowStockThreshold: defaultThreshold, isActive: true, key: makeKey() }], images: [] }; }
function formFromProduct(product: AdminProduct): ProductForm { return { name: product.name, slug: product.slug, description: product.description || "", productType: product.productType, brandId: product.brandId || "", categoryId: product.categoryId || "", scentFamily: product.scentFamily || "", notes: product.notes.join("، "), originCountry: product.originCountry || "", isPublished: product.isPublished, isFeatured: product.isFeatured, isBestSeller: product.isBestSeller, displayOrder: product.displayOrder, variants: product.variants.map((variant) => ({ id: variant.id, sizeLabel: variant.sizeLabel, price: variant.price, compareAtPrice: variant.compareAtPrice || "", stockQuantity: variant.stockQuantity, lowStockThreshold: variant.lowStockThreshold, isActive: variant.isActive, key: variant.id })), images: product.images.map((image) => ({ id: image.id, imageUrl: image.imageUrl, altText: image.altText, displayOrder: image.displayOrder, isPrimary: image.isPrimary, key: image.id })) }; }
function slugFromName(name: string) { return name.toLocaleLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""); }

export function AdminProductsPanel() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [defaultLowStockThreshold, setDefaultLowStockThreshold] = useState(5);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProductForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [catalogTab, setCatalogTab] = useState<"products" | "brands" | "categories">("products");

  const load = useCallback(async (nextPage = 1, nextQuery = query) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(PAGE_SIZE) });
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      const response = await adminGet<AdminProductsResponse>(`/api/admin/products?${params}`);
      setItems(response.items); setPage(response.pagination.page); setHasMore(response.pagination.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تحميل المنتجات."); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { void load(1); void adminGet<{ items: Brand[] }>("/api/admin/brands").then((result) => setBrands(result.items)).catch(() => setBrands([])); void adminGet<AdminCategoriesResponse>("/api/admin/categories").then((result) => setCategories(result.items)).catch(() => setCategories([])); void adminGet<AdminSettingsResponse>("/api/admin/settings").then((result) => setDefaultLowStockThreshold(result.item.lowStockThreshold)).catch(() => setDefaultLowStockThreshold(5)); }, [load]);

  const openNew = () => { setEditingId(null); setNotice(""); setForm(blankForm(defaultLowStockThreshold)); };
  const openEdit = (product: AdminProduct) => { setEditingId(product.id); setNotice(""); setForm(formFromProduct(product)); };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || saving) return;
    if (!form.name.trim() || !form.slug.trim() || form.variants.length < 1 || form.variants.some((variant) => !variant.sizeLabel.trim() || !variant.price.trim() || Number(variant.price) < 0)) {
      setNotice("أدخل اسم المنتج ورابطه، وأضف حجماً واحداً على الأقل مع سعر صحيح."); return;
    }
    if (form.images.filter((image) => image.isPrimary).length > 1) { setNotice("اختر صورة رئيسية واحدة فقط."); return; }
    const payload: AdminProductUpsertRequest = {
      name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim() || null,
      productType: form.productType, brandId: form.brandId || null, categoryId: form.categoryId || null,
      scentFamily: form.scentFamily.trim() || null, notes: form.notes.split(/[،,\n]/).map((note) => note.trim()).filter(Boolean),
      originCountry: form.productType === "original" ? form.originCountry.trim() || null : null, isPublished: form.isPublished, isFeatured: form.isFeatured,
      isBestSeller: form.isBestSeller, displayOrder: Math.max(0, Math.floor(form.displayOrder)),
      variants: form.variants.map(({ key: _key, ...variant }) => ({ id: variant.id, sizeLabel: variant.sizeLabel.trim(), price: variant.price.trim(), compareAtPrice: variant.compareAtPrice.trim() || null, stockQuantity: Math.max(0, Math.floor(variant.stockQuantity)), lowStockThreshold: Math.max(0, Math.floor(variant.lowStockThreshold)), isActive: variant.isActive })),
      images: form.images.map(({ key: _key, ...image }) => ({ id: image.id, imageUrl: image.imageUrl, altText: image.altText, displayOrder: image.displayOrder, isPrimary: image.isPrimary })),
    };
    setSaving(true); setNotice("");
    try {
      if (editingId) await adminPatch<AdminProductResponse>(`/api/admin/products/${encodeURIComponent(editingId)}`, payload);
      else await adminPost<AdminProductResponse>("/api/admin/products", payload);
      setForm(null); setNotice(editingId ? "حُفظت تغييرات المنتج." : "أُضيف المنتج."); await load(1);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "تعذّر حفظ المنتج."); }
    finally { setSaving(false); }
  };

  const unpublish = async (product: AdminProduct) => {
    if (!window.confirm(`إلغاء نشر «${product.name}»؟ سيبقى محفوظاً في سجلات الطلبات.`)) return;
    try { await adminDelete<AdminProductResponse>(`/api/admin/products/${encodeURIComponent(product.id)}`); setNotice("أُلغي نشر المنتج مع الحفاظ على سجلاته."); await load(page); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "تعذّر إلغاء النشر."); }
  };

  if (catalogTab !== "products") return <AdminCatalogPanel kind={catalogTab} onBack={() => setCatalogTab("products")} />;

  if (loading && !items.length && !form) return <AdminLoading label="نحمّل المنتجات..." />;
  if (error && !items.length && !form) return <AdminError message={error} onRetry={() => void load(page)} />;

  return <div className="admin-panel-stack">
    {form ? <ProductEditor form={form} setForm={setForm} brands={brands} categories={categories} defaultLowStockThreshold={defaultLowStockThreshold} saving={saving} notice={notice} editing={Boolean(editingId)} onCancel={() => setForm(null)} onSave={save} /> : <>
      <div className="admin-page-intro"><div><h2>المنتجات</h2><p>إدارة بيانات العطور والأحجام والصور والنشر.</p></div><div className="admin-row-actions"><button className="admin-button admin-button--secondary" onClick={() => setCatalogTab("brands")}>الماركات</button><button className="admin-button admin-button--secondary" onClick={() => setCatalogTab("categories")}>الفئات</button><button className="admin-button admin-button--gold" onClick={openNew}>＋ منتج جديد</button></div></div>
      {notice ? <p className="admin-success" role="status">{notice}</p> : null}
      <form className="admin-toolbar" onSubmit={(event) => { event.preventDefault(); setQuery(searchInput.trim()); void load(1, searchInput.trim()); }}><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="ابحث بالاسم أو الماركة" aria-label="ابحث بالاسم أو الماركة" /><button className="admin-button admin-button--secondary">بحث</button></form>
      {error ? <AdminError message={error} onRetry={() => void load(page)} /> : <div className="admin-card admin-table-wrap"><table className="admin-table"><thead><tr><th>المنتج</th><th>النوع</th><th>الأحجام</th><th>النشر</th><th>الإجراءات</th></tr></thead><tbody>{items.map((product) => <tr key={product.id}><td><div className="admin-product-cell">{product.images[0] ? <Image src={product.images.find((image) => image.isPrimary)?.imageUrl || product.images[0].imageUrl} alt="" width={54} height={54} unoptimized /> : <span className="admin-product-thumb">ر</span>}<div><strong>{product.name}</strong><small>{product.brand?.name || (product.productType === "original" ? "عطر أصلي" : "عطر تركيب")}</small></div></div></td><td>{product.productType === "original" ? "أصلي" : "تركيب"}</td><td>{product.variants.length}</td><td><span className={`admin-pill${product.isPublished ? " admin-pill--green" : ""}`}>{product.isPublished ? "منشور" : "مخفي"}</span></td><td><div className="admin-row-actions"><button className="admin-text-button" onClick={() => openEdit(product)}>تعديل</button>{product.isPublished ? <button className="admin-text-button admin-text-button--danger" onClick={() => void unpublish(product)}>إلغاء النشر</button> : null}</div></td></tr>)}{!items.length ? <tr><td colSpan={5}><p className="admin-empty-inline">ما في منتجات تطابق البحث.</p></td></tr> : null}</tbody></table></div>}
      <div className="admin-pagination"><button className="admin-button admin-button--secondary" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>السابق</button><span>صفحة {page}</span><button className="admin-button admin-button--secondary" disabled={!hasMore || loading} onClick={() => void load(page + 1)}>التالي</button></div>
    </>}
  </div>;
}

function ProductEditor({ form, setForm, brands, categories, defaultLowStockThreshold, saving, notice, editing, onCancel, onSave }: { form: ProductForm; setForm: (form: ProductForm) => void; brands: Brand[]; categories: Category[]; defaultLowStockThreshold: number; saving: boolean; notice: string; editing: boolean; onCancel: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  const [uploading, setUploading] = useState(false);
  const update = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm({ ...form, [key]: value });
  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []); event.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      const newImages: ImageDraft[] = [];
      for (const file of files) {
        if (file.size > 8 * 1024 * 1024) throw new Error(`الصورة ${file.name} أكبر من 8MB.`);
        const result = await adminUpload<AdminUploadResponse>(file, `products/${form.productType}` as AdminAssetKind);
        newImages.push({ imageUrl: result.imageUrl, altText: null, displayOrder: form.images.length + newImages.length, isPrimary: form.images.length === 0 && newImages.length === 0, key: makeKey() });
      }
      update("images", [...form.images, ...newImages]);
    } catch (cause) { update("images", form.images); window.alert(cause instanceof Error ? cause.message : "تعذّر رفع الصورة."); }
    finally { setUploading(false); }
  };
  const moveImage = (index: number, direction: -1 | 1) => { const next = [...form.images]; const swap = index + direction; if (swap < 0 || swap >= next.length) return; [next[index], next[swap]] = [next[swap], next[index]]; update("images", next.map((image, i) => ({ ...image, displayOrder: i }))); };
  const removeImage = (key: string) => { const next = form.images.filter((image) => image.key !== key).map((image, index) => ({ ...image, displayOrder: index })); if (next.length && !next.some((image) => image.isPrimary)) next[0] = { ...next[0], isPrimary: true }; update("images", next); };
  const updateVariant = (key: string, field: keyof VariantDraft, value: string | number | boolean) => update("variants", form.variants.map((variant) => variant.key === key ? { ...variant, [field]: value } : variant));

  return <form className="admin-product-editor" onSubmit={onSave}>
    <div className="admin-page-intro"><div><h2>{editing ? "تعديل المنتج" : "إضافة منتج"}</h2><p>الأسعار تُرسل كقيم عشرية، والمخزون يتحقق منه الخادم عند الطلب.</p></div><div className="admin-row-actions"><button type="button" className="admin-button admin-button--secondary" onClick={onCancel}>إلغاء</button><button className="admin-button admin-button--gold" disabled={saving || uploading}>{saving ? "جارٍ الحفظ..." : "حفظ المنتج"}</button></div></div>
    {notice ? <p className="admin-alert admin-alert--light" role="alert">{notice}</p> : null}
    <div className="admin-editor-grid">
      <section className="admin-card admin-form-card"><h3>معلومات المنتج</h3><div className="admin-form-grid"><label className="admin-field admin-field--light">اسم المنتج<input required maxLength={180} value={form.name} onChange={(event) => { const name = event.target.value; update("name", name); if (!editing || !form.slug) update("slug", slugFromName(name)); }} /></label><label className="admin-field admin-field--light">الرابط (slug)<input required maxLength={200} dir="ltr" value={form.slug} onChange={(event) => update("slug", slugFromName(event.target.value))} /></label><label className="admin-field admin-field--light">نوع المنتج<select value={form.productType} onChange={(event) => update("productType", event.target.value as ProductType)}><option value="original">عطر أصلي</option><option value="blended">عطر تركيب</option></select></label><label className="admin-field admin-field--light">الماركة<select value={form.brandId} onChange={(event) => update("brandId", event.target.value)}><option value="">بدون ماركة</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.isActive ? "" : " · مخفية"}</option>)}</select></label><label className="admin-field admin-field--light">الفئة<select value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}><option value="">بدون فئة</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? "" : " · مخفية"}</option>)}</select></label><label className="admin-field admin-field--light">عائلة الرائحة<input maxLength={100} value={form.scentFamily} onChange={(event) => update("scentFamily", event.target.value)} placeholder="مثال: خشبي" /></label><label className="admin-field admin-field--light">بلد المنشأ<input maxLength={120} value={form.originCountry} onChange={(event) => update("originCountry", event.target.value)} /></label><label className="admin-field admin-field--light">ترتيب العرض<input type="number" min="0" value={form.displayOrder} onChange={(event) => update("displayOrder", Number(event.target.value))} /></label></div><label className="admin-field admin-field--light">الوصف<textarea rows={4} maxLength={5000} value={form.description} onChange={(event) => update("description", event.target.value)} /></label><label className="admin-field admin-field--light">النوتات العطرية <small>افصل بينها بفاصلة</small><input value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label><div className="admin-check-row"><label><input type="checkbox" checked={form.isPublished} onChange={(event) => update("isPublished", event.target.checked)} /> منشور للزوار</label><label><input type="checkbox" checked={form.isFeatured} onChange={(event) => update("isFeatured", event.target.checked)} /> مختار بعناية</label><label><input type="checkbox" checked={form.isBestSeller} onChange={(event) => update("isBestSeller", event.target.checked)} /> الأكثر مبيعاً</label></div></section>
      <section className="admin-card admin-form-card"><div className="admin-card__heading"><h3>الأحجام والأسعار والمخزون</h3><button type="button" className="admin-text-button" onClick={() => update("variants", [...form.variants, { sizeLabel: "", price: "", compareAtPrice: "", stockQuantity: 0, lowStockThreshold: defaultLowStockThreshold, isActive: true, key: makeKey() }])}>＋ إضافة حجم</button></div>{form.variants.map((variant, index) => <div className="admin-variant-editor" key={variant.key}><div className="admin-card__heading"><strong>حجم {index + 1}</strong>{form.variants.length > 1 ? <button type="button" className="admin-text-button admin-text-button--danger" onClick={() => update("variants", form.variants.filter((item) => item.key !== variant.key))}>إزالة</button> : null}</div><div className="admin-form-grid"><label className="admin-field admin-field--light">الحجم<input required value={variant.sizeLabel} onChange={(event) => updateVariant(variant.key, "sizeLabel", event.target.value)} placeholder="مثال: 50 مل" /></label><label className="admin-field admin-field--light">السعر (₪)<input required inputMode="decimal" value={variant.price} onChange={(event) => updateVariant(variant.key, "price", event.target.value)} placeholder="0.00" /></label><label className="admin-field admin-field--light">السعر السابق (اختياري)<input inputMode="decimal" value={variant.compareAtPrice} onChange={(event) => updateVariant(variant.key, "compareAtPrice", event.target.value)} placeholder="0.00" /></label><label className="admin-field admin-field--light">المخزون<input type="number" min="0" value={variant.stockQuantity} onChange={(event) => updateVariant(variant.key, "stockQuantity", Number(event.target.value))} /></label><label className="admin-field admin-field--light">حد انخفاض المخزون<input type="number" min="0" value={variant.lowStockThreshold} onChange={(event) => updateVariant(variant.key, "lowStockThreshold", Number(event.target.value))} /></label></div><label className="admin-check-row"><input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(variant.key, "isActive", event.target.checked)} /> الحجم نشط</label></div>)}</section>
      <section className="admin-card admin-form-card admin-editor-images"><div className="admin-card__heading"><div><h3>صور المنتج</h3><p className="admin-inline-note">JPEG أو PNG أو WebP، حتى 8MB لكل صورة. تُفحص وتُضغط إلى WebP على الخادم.</p></div><label className="admin-button admin-button--secondary">{uploading ? "جارٍ رفع الصور..." : "＋ رفع صور"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={uploadImages} hidden /></label></div>{form.images.length ? <div className="admin-image-grid">{form.images.map((image, index) => <article className="admin-image-card" key={image.key}><Image src={image.imageUrl} alt={image.altText || "صورة المنتج"} width={200} height={200} unoptimized /><div className="admin-image-card__actions"><label><input type="radio" name="primary-image" checked={image.isPrimary} onChange={() => update("images", form.images.map((item) => ({ ...item, isPrimary: item.key === image.key })))} /> رئيسية</label><div><button type="button" onClick={() => moveImage(index, -1)} aria-label="تحريك الصورة للأعلى">↑</button><button type="button" onClick={() => moveImage(index, 1)} aria-label="تحريك الصورة للأسفل">↓</button><button type="button" className="admin-danger-icon" onClick={() => removeImage(image.key)} aria-label="إزالة الصورة من المنتج">×</button></div></div><input className="admin-image-alt" value={image.altText || ""} maxLength={240} placeholder="وصف الصورة (اختياري)" onChange={(event) => update("images", form.images.map((item) => item.key === image.key ? { ...item, altText: event.target.value || null } : item))} /></article>)}</div> : <p className="admin-empty-inline">ما في صور مضافة بعد.</p>}<p className="admin-inline-note">إزالة صورة من المنتج لا تحذف الملف الأصلي من التخزين.</p></section>
    </div>
    <div className="admin-editor-bottom"><button type="button" className="admin-button admin-button--secondary" onClick={onCancel}>إلغاء</button><button className="admin-button admin-button--gold" disabled={saving || uploading}>{saving ? "جارٍ الحفظ..." : "حفظ المنتج"}</button></div>
  </form>;
}
