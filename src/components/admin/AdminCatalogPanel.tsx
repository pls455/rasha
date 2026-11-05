"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import type { AdminAdminBrandsResponse, AdminCategoriesResponse, AdminUploadResponse } from "@/lib/contracts/admin";
import type { Brand, Category } from "@/lib/contracts/storefront";
import { adminDelete, adminGet, adminPatch, adminPost, adminUpload } from "@/lib/admin-api";
import { AdminError, AdminLoading } from "@/components/admin/AdminDashboardPanel";

type CatalogTab = "brands" | "categories";
type CatalogItem = Brand | Category;
type CatalogForm = { name: string; slug: string; description: string; imageUrl: string; isActive: boolean; displayOrder: number };
const emptyForm = (): CatalogForm => ({ name: "", slug: "", description: "", imageUrl: "", isActive: true, displayOrder: 0 });
const slugify = (value: string) => value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

export function AdminCatalogPanel({ kind, onBack }: { kind: CatalogTab; onBack: () => void }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CatalogForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const isCategory = kind === "categories";
  const endpoint = `/api/admin/${kind}`;
  const title = isCategory ? "الفئات" : "الماركات";
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = isCategory ? await adminGet<AdminCategoriesResponse>(endpoint) : await adminGet<AdminAdminBrandsResponse>(endpoint); setItems(response.items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `تعذّر تحميل ${title}.`); }
    finally { setLoading(false); }
  }, [endpoint, isCategory, title]);
  useEffect(() => { void load(); }, [load]);
  const beginEdit = (item?: CatalogItem) => {
    setNotice(""); setEditingId(item?.id || null);
    setForm(item ? { name: item.name, slug: "slug" in item ? item.slug : "", description: item.description || "", imageUrl: isCategory ? ("imageUrl" in item ? item.imageUrl || "" : "") : ("logoUrl" in item ? item.logoUrl || "" : ""), isActive: item.isActive, displayOrder: "displayOrder" in item ? item.displayOrder : 0 } : emptyForm());
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file || !form) return;
    if (file.size > 8 * 1024 * 1024) { setError("حجم الملف أكبر من 8MB."); return; }
    setUploading(true); setError("");
    try { const result = await adminUpload<AdminUploadResponse>(file, isCategory ? "categories" : "branding"); setForm({ ...form, imageUrl: result.imageUrl }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر رفع الصورة."); }
    finally { setUploading(false); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!form || saving) return;
    if (!form.name.trim() || (isCategory && !form.slug.trim())) { setError("أدخل الاسم والرابط للفئة."); return; }
    setSaving(true); setError(""); setNotice("");
    const payload = isCategory ? { name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim() || null, imageUrl: form.imageUrl.trim() || null, isActive: form.isActive, displayOrder: Math.max(0, Math.floor(form.displayOrder)) } : { name: form.name.trim(), description: form.description.trim() || null, logoUrl: form.imageUrl.trim() || null, isActive: form.isActive };
    try { if (editingId) await adminPatch(`${endpoint}/${encodeURIComponent(editingId)}`, payload); else await adminPost(endpoint, payload); setForm(null); setNotice(`حُفظت ${isCategory ? "الفئة" : "الماركة"}.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر الحفظ."); }
    finally { setSaving(false); }
  };
  const disable = async (item: CatalogItem) => { if (!window.confirm(`تعطيل «${item.name}»؟ ستبقى مرتبطة بالسجلات القديمة.`)) return; try { await adminDelete(`${endpoint}/${encodeURIComponent(item.id)}`); setNotice(`عُطّلت ${isCategory ? "الفئة" : "الماركة"}.`); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر التعطيل."); } };

  if (loading && !items.length && !form) return <AdminLoading label={`نحمّل ${title}...`} />;
  if (error && !items.length && !form) return <AdminError message={error} onRetry={load} />;
  return <div className="admin-panel-stack"><div className="admin-page-intro"><div><button className="admin-text-button" onClick={onBack}>← رجوع إلى المنتجات</button><h2>إدارة {title}</h2><p>التعطيل يحافظ على روابط المنتجات القديمة.</p></div><button className="admin-button admin-button--gold" onClick={() => beginEdit()}>{`＋ ${isCategory ? "فئة" : "ماركة"}`}</button></div>{notice ? <p className="admin-success" role="status">{notice}</p> : null}{error ? <AdminError message={error} onRetry={load} /> : null}
    {form ? <form className="admin-card admin-catalog-form" onSubmit={save}><div className="admin-card__heading"><h3>{editingId ? `تعديل ${isCategory ? "الفئة" : "الماركة"}` : `إضافة ${isCategory ? "فئة" : "ماركة"}`}</h3><button className="admin-text-button" type="button" onClick={() => setForm(null)}>إلغاء</button></div><div className="admin-form-grid"><label className="admin-field admin-field--light">الاسم<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, ...(!editingId && isCategory ? { slug: slugify(event.target.value) } : {}) })} /></label>{isCategory ? <label className="admin-field admin-field--light">الرابط (slug)<input dir="ltr" required value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} /></label> : null}<label className="admin-field admin-field--light admin-form-wide">الوصف<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="admin-field admin-field--light">{isCategory ? "رابط الصورة" : "رابط الشعار"}<input dir="ltr" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></label><label className="admin-button admin-button--secondary admin-upload-button">{uploading ? "جارٍ الرفع..." : "رفع صورة"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} hidden onChange={upload} /></label>{isCategory ? <label className="admin-field admin-field--light">ترتيب العرض<input type="number" min="0" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></label> : null}</div>{form.imageUrl ? <Image className="admin-content-preview" src={form.imageUrl} alt="معاينة" width={440} height={220} unoptimized /> : null}<label className="admin-switch"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> نشطة</label><button className="admin-button admin-button--gold" disabled={saving || uploading}>{saving ? "جارٍ الحفظ..." : "حفظ"}</button></form> : null}
    <div className="admin-card admin-table-wrap"><table className="admin-table"><thead><tr><th>{isCategory ? "الفئة" : "الماركة"}</th><th>الحالة</th>{isCategory ? <th>الترتيب</th> : null}<th>إجراءات</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{"slug" in item ? item.slug : ("description" in item ? item.description : "")}</small></td><td><span className={`admin-pill${item.isActive ? " admin-pill--green" : ""}`}>{item.isActive ? "نشطة" : "مخفية"}</span></td>{isCategory ? <td>{"displayOrder" in item ? item.displayOrder : 0}</td> : null}<td><div className="admin-row-actions"><button className="admin-text-button" onClick={() => beginEdit(item)}>تعديل</button>{item.isActive ? <button className="admin-text-button admin-text-button--danger" onClick={() => void disable(item)}>تعطيل</button> : null}</div></td></tr>)}{!items.length ? <tr><td colSpan={isCategory ? 4 : 3}><p className="admin-empty-inline">لا توجد عناصر بعد.</p></td></tr> : null}</tbody></table></div>
  </div>;
}
