"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminDashboardResponse } from "@/lib/contracts/admin";
import { adminGet } from "@/lib/admin-api";
import { formatIls } from "@/lib/money";

const statusLabels: Record<string, string> = {
  whatsapp_initiated: "بانتظار واتساب",
  contacted: "تم التواصل",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  out_for_delivery: "خرج للتوصيل",
  delivered: "مكتمل",
  cancelled: "ملغي",
};

export function AdminDashboardPanel() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await adminGet<AdminDashboardResponse>("/api/admin/dashboard")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تحميل الإحصاءات."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <AdminError message={error} onRetry={load} />;
  if (loading || !data) return <AdminLoading label="نجهّز ملخص المتجر..." />;
  const { stats } = data;
  const cards = [
    ["إجمالي المنتجات", stats.totalProducts, "بما فيها المنتجات المخفية"],
    ["المنتجات المنشورة", stats.publishedProducts, "ظاهرة للزوار"],
    ["المتوفرة", stats.availableProducts, "لديها أحجام بمخزون"],
    ["أحجام منخفضة المخزون", stats.lowStockVariants, "بحسب الحد المحدد لكل حجم"],
  ] as const;

  return <div className="admin-panel-stack">
    <div className="admin-page-intro"><div><h2>ملخص المتجر</h2><p>إجماليات الطلبات تراكمية منذ بداية المتجر.</p></div><button className="admin-button admin-button--secondary" onClick={() => void load()}>تحديث</button></div>
    <div className="admin-stats-grid">{cards.map(([label, value, caption]) => <article className="admin-stat-card" key={label}><span>{label}</span><strong>{value.toLocaleString("ar-PS")}</strong><small>{caption}</small></article>)}</div>
    <div className="admin-summary-grid">
      <section className="admin-card"><div className="admin-card__heading"><h3>الطلبات حسب الحالة</h3></div><div className="admin-status-list">{Object.entries(stats.ordersByStatus).map(([status, count]) => <div className="admin-status-row" key={status}><span>{statusLabels[status] || status}</span><strong>{count.toLocaleString("ar-PS")}</strong></div>)}</div></section>
      <section className="admin-card"><div className="admin-card__heading"><h3>قيمة الطلبات</h3></div><div className="admin-value-row"><span>الطلبات المؤكدة</span><strong>{formatIls(stats.confirmedSubtotal)}</strong></div><div className="admin-value-row"><span>الطلبات المكتملة</span><strong>{formatIls(stats.deliveredSubtotal)}</strong></div><p className="admin-inline-note">هذه قيمة الطلبات المسجلة، وليست إيراداً محصّلاً.</p></section>
    </div>
    <section className="admin-card"><div className="admin-card__heading"><h3>الأكثر طلباً من الطلبات المؤكدة</h3><span>الكمية المؤكدة</span></div>{data.topProducts.length ? <div className="admin-top-products">{data.topProducts.slice(0, 8).map((product, index) => <div className="admin-top-product" key={product.productId}><span className="admin-rank">{String(index + 1).padStart(2,"0")}</span><strong>{product.productName}</strong><span>{product.confirmedQuantity.toLocaleString("ar-PS")}</span></div>)}</div> : <p className="admin-empty-inline">لا توجد طلبات مؤكدة بعد.</p>}</section>
  </div>;
}

export function AdminLoading({ label }: { label: string }) { return <div className="admin-loading" role="status">{label}</div>; }
export function AdminError({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="admin-error" role="alert"><p>{message}</p><button className="admin-button admin-button--secondary" onClick={onRetry}>حاول مرة أخرى</button></div>; }
