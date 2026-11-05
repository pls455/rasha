"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminLog, AdminLogsResponse } from "@/lib/contracts/admin";
import { adminGet } from "@/lib/admin-api";
import { AdminError, AdminLoading } from "@/components/admin/AdminDashboardPanel";

const PAGE_SIZE = 25;
const actionLabels: Record<string, string> = { product_created: "إضافة منتج", product_updated: "تعديل منتج", product_unpublished: "إلغاء نشر", order_status_changed: "تغيير حالة طلب", inventory_adjusted: "تعديل مخزون", review_approved: "اعتماد تقييم", review_rejected: "رفض تقييم", content_updated: "تعديل محتوى", settings_updated: "تعديل إعدادات" };

export function AdminLogsPanel() {
  const [items, setItems] = useState<AdminLog[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (next = 1) => { setLoading(true); setError(""); try { const response = await adminGet<AdminLogsResponse>(`/api/admin/logs?page=${next}&pageSize=${PAGE_SIZE}`); setItems(response.items); setPage(response.pagination.page); setHasMore(response.pagination.hasMore); } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تحميل سجل النشاط."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading && !items.length) return <AdminLoading label="نحمّل سجل النشاط..." />;
  return <div className="admin-panel-stack"><div className="admin-page-intro"><div><h2>سجل النشاط</h2><p>تغييرات المتجر محفوظة للمراجعة والمساءلة.</p></div><button className="admin-button admin-button--secondary" onClick={() => void load(page)}>تحديث</button></div>{error ? <AdminError message={error} onRetry={() => void load(page)} /> : null}<div className="admin-activity-list">{items.map((item) => <article className="admin-card admin-activity-row" key={item.id}><div className="admin-activity-mark" aria-hidden="true">◌</div><div className="admin-activity-main"><div className="admin-activity-heading"><strong>{actionLabels[item.action] || item.action}</strong><span>{item.entityType}{item.entityId ? ` · ${item.entityId.slice(0, 8)}` : ""}</span></div><small>{new Date(item.createdAt).toLocaleString("ar-PS", { dateStyle: "medium", timeStyle: "short" })}{item.actorId ? ` · ${item.actorId.slice(0, 8)}` : ""}</small><details><summary>تفاصيل التغيير</summary><div className="admin-log-values">{item.oldValues ? <div><small>قبل</small><pre>{JSON.stringify(item.oldValues, null, 2)}</pre></div> : null}{item.newValues ? <div><small>بعد</small><pre>{JSON.stringify(item.newValues, null, 2)}</pre></div> : null}</div></details></div></article>)}{!items.length && !loading ? <div className="admin-card admin-empty-state">لا توجد تغييرات مسجلة حتى الآن.</div> : null}</div><div className="admin-pagination"><button className="admin-button admin-button--secondary" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>السابق</button><span>صفحة {page}</span><button className="admin-button admin-button--secondary" disabled={!hasMore || loading} onClick={() => void load(page + 1)}>التالي</button></div></div>;
}
