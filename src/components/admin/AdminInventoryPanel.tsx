"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminInventoryItem, AdminInventoryLog, AdminInventoryResponse, AdminInventoryUpdateResponse } from "@/lib/contracts/admin";
import { AdminApiError, adminGet, adminPatch } from "@/lib/admin-api";
import { formatIls } from "@/lib/money";
import { AdminError, AdminLoading } from "@/components/admin/AdminDashboardPanel";

const PAGE_SIZE = 20;
const changeLabels: Record<AdminInventoryLog["changeType"], string> = { order_confirmed: "تأكيد طلب", order_cancelled: "إلغاء طلب", manual_adjustment: "تعديل يدوي" };

export function AdminInventoryPanel() {
  const [items, setItems] = useState<AdminInventoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lowStock, setLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<AdminInventoryItem | null>(null);
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<AdminInventoryLog[]>([]);
  const [logVariantId, setLogVariantId] = useState("");

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(PAGE_SIZE) });
      if (lowStock) params.set("lowStock", "true");
      const result = await adminGet<AdminInventoryResponse>(`/api/admin/inventory?${params}`);
      setItems(result.items); setPage(result.pagination.page); setHasMore(result.pagination.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تحميل المخزون."); }
    finally { setLoading(false); }
  }, [lowStock]);
  useEffect(() => { void load(1); }, [load]);

  const openAdjust = (item: AdminInventoryItem) => { setEditing(item); setChange(""); setReason(""); setLogs([]); setLogVariantId(""); };
  const showLogs = async (variantId: string) => {
    setLogVariantId(variantId); setLogs([]);
    try { const result = await adminGet<{ items: AdminInventoryLog[] }>(`/api/admin/inventory/logs?variantId=${encodeURIComponent(variantId)}&page=1`); setLogs(result.items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تحميل حركة المخزون."); }
  };
  const saveAdjustment = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || saving) return;
    const quantityChange = Number(change);
    if (!Number.isSafeInteger(quantityChange) || quantityChange === 0 || !reason.trim()) { setError("أدخل عدد وحدات صحيحاً غير صفري وسبباً للتعديل."); return; }
    if (!window.confirm(`${quantityChange < 0 ? "خصم" : "إضافة"} ${Math.abs(quantityChange)} من «${editing.productName}» (${editing.sizeLabel})؟`)) return;
    setSaving(true); setError(""); setNotice("");
    try { const result = await adminPatch<AdminInventoryUpdateResponse>(`/api/admin/inventory/${encodeURIComponent(editing.variantId)}`, { quantityChange, reason: reason.trim() }); setNotice(`تحدّث المخزون إلى ${result.variant.stockQuantity} وحدة، وسُجّلت الحركة.`); setEditing(null); await load(page); }
    catch (cause) { setError(cause instanceof AdminApiError && cause.status === 409 ? cause.message : cause instanceof Error ? cause.message : "تعذّر تعديل المخزون."); }
    finally { setSaving(false); }
  };

  if (loading && !items.length && !editing) return <AdminLoading label="نحمّل المخزون..." />;
  return <div className="admin-panel-stack"><div className="admin-page-intro"><div><h2>المخزون</h2><p>كل تغيير يدوي يحتاج سبباً ويُحفظ في سجل الحركات.</p></div><button className="admin-button admin-button--secondary" onClick={() => void load(page)}>تحديث</button></div>
    <label className="admin-toggle-filter"><input type="checkbox" checked={lowStock} onChange={(event) => setLowStock(event.target.checked)} /> اعرض الأحجام منخفضة المخزون فقط</label>
    {notice ? <p className="admin-success" role="status">{notice}</p> : null}{error ? <AdminError message={error} onRetry={() => void load(page)} /> : null}
    {editing ? <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><form className="admin-modal" onSubmit={saveAdjustment}><button type="button" className="admin-modal__close" onClick={() => setEditing(null)} aria-label="إغلاق">×</button><p className="eyebrow">تعديل المخزون</p><h3>{editing.productName} · {editing.sizeLabel}</h3><p className="admin-inline-note">المتوفر الآن: <strong>{editing.stockQuantity}</strong> وحدة</p><label className="admin-field admin-field--light">تغيير الكمية (الموجب يضيف، والسالب يخصم)<input type="number" step="1" required value={change} onChange={(event) => setChange(event.target.value)} placeholder="مثال: 5 أو -2" /></label><label className="admin-field admin-field--light">سبب التعديل<textarea required maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="مثال: جرد يدوي" /></label>{error ? <p className="admin-alert admin-alert--light" role="alert">{error}</p> : null}<button className="admin-button admin-button--gold" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ وتسجيل الحركة"}</button></form></div> : null}
    <div className="admin-card admin-table-wrap"><table className="admin-table"><thead><tr><th>المنتج / الحجم</th><th>السعر</th><th>المتوفر</th><th>حد التنبيه</th><th>تحديث</th><th></th></tr></thead><tbody>{items.map((item) => <tr key={item.variantId}><td><strong>{item.productName}</strong><small>{item.sizeLabel} · {item.productType === "original" ? "أصلي" : "تركيب"}</small></td><td>{formatIls(item.price)}</td><td><span className={item.stockQuantity <= item.lowStockThreshold ? "admin-stock-low" : ""}>{item.stockQuantity}</span></td><td>{item.lowStockThreshold}</td><td>{new Date(item.updatedAt).toLocaleDateString("ar-PS")}</td><td><div className="admin-row-actions"><button className="admin-text-button" onClick={() => openAdjust(item)}>تعديل</button><button className="admin-text-button" onClick={() => void showLogs(item.variantId)}>السجل</button></div></td></tr>)}{!items.length && !loading ? <tr><td colSpan={6}><p className="admin-empty-inline">ما في أحجام بهذه الفلاتر.</p></td></tr> : null}</tbody></table></div>
    {logVariantId ? <section className="admin-card"><div className="admin-card__heading"><h3>حركة المخزون</h3><button className="admin-text-button" onClick={() => { setLogVariantId(""); setLogs([]); }}>إغلاق</button></div>{logs.length ? <div className="admin-log-list">{logs.map((log) => <div className="admin-log-row" key={log.id}><span>{changeLabels[log.changeType]}</span><span>{log.reason}</span><span>{log.previousQuantity} → {log.newQuantity}</span><small>{new Date(log.createdAt).toLocaleString("ar-PS")}</small></div>)}</div> : <p className="admin-empty-inline">لا توجد حركات مسجلة لهذا الحجم.</p>}</section> : null}
    <div className="admin-pagination"><button className="admin-button admin-button--secondary" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>السابق</button><span>صفحة {page}</span><button className="admin-button admin-button--secondary" disabled={!hasMore || loading} onClick={() => void load(page + 1)}>التالي</button></div>
  </div>;
}
