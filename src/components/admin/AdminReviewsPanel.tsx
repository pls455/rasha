"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminReview, AdminReviewsResponse, AdminReviewResponse } from "@/lib/contracts/admin";
import { AdminApiError, adminDelete, adminGet, adminPatch } from "@/lib/admin-api";
import { AdminError, AdminLoading } from "@/components/admin/AdminDashboardPanel";

const PAGE_SIZE = 20;
const labels = { pending: "بانتظار المراجعة", approved: "مقبول", rejected: "مرفوض" } as const;

export function AdminReviewsPanel() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async (nextPage = 1) => {
    setLoading(true); setError("");
    try { const params = new URLSearchParams({ status, page: String(nextPage), pageSize: String(PAGE_SIZE) }); const result = await adminGet<AdminReviewsResponse>(`/api/admin/reviews?${params}`); setItems(result.items); setPage(result.pagination.page); setHasMore(result.pagination.hasMore); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تحميل التقييمات."); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { void load(1); }, [load]);
  const moderate = async (review: AdminReview, next: "approved" | "rejected") => {
    if (!window.confirm(next === "approved" ? `نشر تقييم ${review.customerName} عن ${review.productName}؟` : "رفض هذا التقييم؟")) return;
    setSaving(review.id); setError(""); setNotice("");
    try { await adminPatch<AdminReviewResponse>(`/api/admin/reviews/${encodeURIComponent(review.id)}`, { status: next }); setNotice(next === "approved" ? "نُشر التقييم بعد اعتماده." : "رُفض التقييم."); await load(page); }
    catch (cause) { setError(cause instanceof AdminApiError && cause.status === 409 ? cause.message : cause instanceof Error ? cause.message : "تعذّر تحديث التقييم."); }
    finally { setSaving(""); }
  };
  const remove = async (review: AdminReview) => {
    if (!window.confirm(`حذف تقييم ${review.customerName} عن ${review.productName} نهائياً؟`)) return;
    setSaving(review.id); setError(""); setNotice("");
    try { await adminDelete<{ deleted: true }>(`/api/admin/reviews/${encodeURIComponent(review.id)}`); setNotice("حُذف التقييم."); await load(page); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر حذف التقييم."); }
    finally { setSaving(""); }
  };
  if (loading && !items.length) return <AdminLoading label="نحمّل التقييمات..." />;
  return <div className="admin-panel-stack"><div className="admin-page-intro"><div><h2>التقييمات</h2><p>ما يظهر للزوار هو التقييمات التي اعتمدتها فقط.</p></div><button className="admin-button admin-button--secondary" onClick={() => void load(page)}>تحديث</button></div><div className="admin-toolbar"><label>الحالة<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>{notice ? <p className="admin-success" role="status">{notice}</p> : null}{error ? <AdminError message={error} onRetry={() => void load(page)} /> : null}<div className="admin-reviews-grid">{items.map((review) => <article className="admin-card admin-review-card" key={review.id}><div className="admin-review-card__top"><span className="admin-pill">{labels[review.status]}</span><time>{new Date(review.createdAt).toLocaleDateString("ar-PS")}</time></div><div className="admin-review-stars" aria-label={`التقييم ${review.rating} من 5`}>{"★".repeat(Math.max(0, Math.min(5, review.rating)))}</div>{review.comment ? <blockquote>“{review.comment}”</blockquote> : <p className="admin-inline-note">لم يكتب العميل تعليقاً.</p>}<div className="admin-review-by"><strong>{review.customerName}</strong><small>{review.productName}</small></div><div className="admin-row-actions">{review.status === "pending" ? <><button className="admin-button admin-button--gold" disabled={saving === review.id} onClick={() => void moderate(review, "approved")}>اعتماد ونشر</button><button className="admin-button admin-button--secondary admin-button--danger" disabled={saving === review.id} onClick={() => void moderate(review, "rejected")}>رفض</button></> : null}<button className="admin-text-button admin-text-button--danger" disabled={saving === review.id} onClick={() => void remove(review)}>حذف</button></div></article>)}{!items.length && !loading ? <div className="admin-card admin-empty-state">ما في تقييمات بهذه الحالة.</div> : null}</div><div className="admin-pagination"><button className="admin-button admin-button--secondary" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>السابق</button><span>صفحة {page}</span><button className="admin-button admin-button--secondary" disabled={!hasMore || loading} onClick={() => void load(page + 1)}>التالي</button></div></div>;
}
