"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminOrder, AdminOrderResponse, AdminOrdersQuery, AdminOrdersResponse } from "@/lib/contracts/admin";
import type { OrderStatus } from "@/lib/contracts/storefront";
import { AdminApiError, adminGet, adminPatch } from "@/lib/admin-api";
import { formatIls } from "@/lib/money";
import { AdminError, AdminLoading } from "@/components/admin/AdminDashboardPanel";

const statusLabels: Record<OrderStatus, string> = { whatsapp_initiated: "بانتظار واتساب", contacted: "تم التواصل", confirmed: "مؤكد", preparing: "قيد التجهيز", out_for_delivery: "خرج للتوصيل", delivered: "مكتمل", cancelled: "ملغي" };
const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { whatsapp_initiated: "contacted", contacted: "confirmed", confirmed: "preparing", preparing: "out_for_delivery", out_for_delivery: "delivered" };
const PAGE_SIZE = 15;

export function AdminOrdersPanel() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true); setError("");
    try {
      const filters: AdminOrdersQuery = { q: query.trim() || undefined, status: statusFilter || undefined, from: from || undefined, to: to || undefined, page: nextPage, pageSize: PAGE_SIZE };
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
      const result = await adminGet<AdminOrdersResponse>(`/api/admin/orders?${params}`);
      setOrders(result.items); setPage(result.pagination.page); setHasMore(result.pagination.hasMore);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تحميل الطلبات."); }
    finally { setLoading(false); }
  }, [statusFilter, from, to, query]);
  useEffect(() => { void load(1); }, [load]);

  const changeStatus = async (order: AdminOrder, status: OrderStatus) => {
    const prompt = status === "confirmed" ? "تأكيد الطلب سيخصم الكمية المتاحة لكل حجم. هل تريد المتابعة؟" : `تغيير حالة الطلب ${order.orderNumber} إلى «${statusLabels[status]}»؟`;
    if (!window.confirm(prompt)) return;
    setSavingId(order.id); setError(""); setNotice("");
    try { await adminPatch<AdminOrderResponse>(`/api/admin/orders/${encodeURIComponent(order.id)}/status`, { status }); setNotice(`تحدّثت حالة الطلب ${order.orderNumber}.`); await load(page); }
    catch (cause) { setError(cause instanceof AdminApiError && cause.status === 409 ? `${cause.message} حدّث القائمة قبل المحاولة.` : cause instanceof Error ? cause.message : "تعذّر تحديث الطلب."); }
    finally { setSavingId(""); }
  };

  if (loading && !orders.length) return <AdminLoading label="نحمّل الطلبات..." />;
  return <div className="admin-panel-stack"><div className="admin-page-intro"><div><h2>الطلبات</h2><p>تابع ما وصل من المتجر وحدّث الحالة بحسب سير التجهيز.</p></div><button className="admin-button admin-button--secondary" onClick={() => void load(page)}>تحديث</button></div>
    <form className="admin-toolbar admin-toolbar--filters" onSubmit={(event) => { event.preventDefault(); setQuery(searchInput.trim()); }}><label>بحث<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="رقم الطلب أو الاسم أو الهاتف" /></label><label>الحالة<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "")}><option value="">كل الحالات</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>من<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>إلى<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="admin-button admin-button--secondary">بحث</button><button type="button" className="admin-button admin-button--secondary" onClick={() => { setStatusFilter(""); setFrom(""); setTo(""); setQuery(""); setSearchInput(""); }}>مسح الفلاتر</button></form>
    {notice ? <p className="admin-success" role="status">{notice}</p> : null}{error ? <AdminError message={error} onRetry={() => void load(page)} /> : null}
    <div className="admin-orders-list">{orders.map((order) => { const customerDigits = order.customerPhone?.replace(/\D/g, "") || ""; return <article className="admin-card admin-order-card" key={order.id}><div className="admin-order-card__top"><div><span className="admin-order-number">{order.orderNumber}</span><span className="admin-order-date">{new Date(order.createdAt).toLocaleString("ar-PS", { dateStyle: "medium", timeStyle: "short" })}</span></div><span className={`admin-pill admin-status--${order.status}`}>{statusLabels[order.status]}</span></div><div className="admin-order-card__main"><div><strong>{order.customerName || "عميل"}</strong>{order.customerPhone ? <><a href={`tel:${order.customerPhone}`} dir="ltr">{order.customerPhone}</a>{customerDigits ? <a className="admin-text-button" href={`https://wa.me/${encodeURIComponent(customerDigits)}`} target="_blank" rel="noreferrer">واتساب ↗</a> : null}</> : <small>لم يضف رقم هاتف</small>}</div><div><strong>{formatIls(order.subtotal)}</strong><small>{order.items.length} أصناف</small></div></div><details className="admin-order-details"><summary>تفاصيل الطلب</summary><div className="admin-order-items">{order.items.map((item, index) => <div key={`${item.variantId || item.productId || "item"}-${index}`}><span>{item.productNameSnapshot} · {item.productTypeSnapshot === "original" ? "أصلي" : "تركيب"} · {item.variantNameSnapshot} × {item.quantity}</span><strong>{formatIls(item.lineTotal)}</strong></div>)}</div>{order.notes ? <p className="admin-order-note">ملاحظة: {order.notes}</p> : null}{order.deliveryCost ? <p className="admin-order-note">التوصيل: {formatIls(order.deliveryCost)}</p> : null}</details><div className="admin-order-card__actions">{nextStatus[order.status] ? <button className="admin-button admin-button--gold" disabled={savingId === order.id} onClick={() => void changeStatus(order, nextStatus[order.status]!)}>{savingId === order.id ? "جارٍ الحفظ..." : `التالي: ${statusLabels[nextStatus[order.status]!]}`}</button> : null}{order.status !== "cancelled" && order.status !== "delivered" ? <button className="admin-text-button admin-text-button--danger" disabled={savingId === order.id} onClick={() => void changeStatus(order, "cancelled")}>إلغاء الطلب</button> : null}</div></article>; })}{!orders.length && !loading ? <div className="admin-card admin-empty-state">ما في طلبات بهذه الفلاتر.</div> : null}</div>
    <div className="admin-pagination"><button className="admin-button admin-button--secondary" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>السابق</button><span>صفحة {page}</span><button className="admin-button admin-button--secondary" disabled={!hasMore || loading} onClick={() => void load(page + 1)}>التالي</button></div>
  </div>;
}
