"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AdminSettings, AdminSettingsResponse, AdminSettingsUpdateRequest } from "@/lib/contracts/admin";
import { missingOrderMessageTemplateTokens } from "@/lib/contracts/admin";
import { adminGet, adminPatch } from "@/lib/admin-api";
import { AdminError, AdminLoading } from "@/components/admin/AdminDashboardPanel";

const policyLabels: Record<string, string> = { shipping: "الطلبات والتوصيل", delivery: "الطلبات والتوصيل (بديل)", returns: "الاستبدال والاسترجاع", privacy: "الخصوصية", terms: "الشروط والأحكام" };

export function AdminSettingsPanel() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await adminGet<AdminSettingsResponse>("/api/admin/settings"); setSettings(response.item); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر تحميل الإعدادات."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!settings || saving) return;
    if (!settings.storeName.trim() || !settings.whatsappNumber.trim() || !Number.isSafeInteger(settings.lowStockThreshold) || settings.lowStockThreshold < 0) { setError("أدخل اسم المتجر ورقم واتساب وحداً صحيحاً للمخزون."); return; }
    const missingTokens = missingOrderMessageTemplateTokens(settings.orderMessageTemplate);
    if (missingTokens.length) { setError(`أكمل قالب الطلب. الرموز المطلوبة: ${missingTokens.join("، ")}`); return; }
    setSaving(true); setError(""); setNotice("");
    try { const payload: AdminSettingsUpdateRequest = { storeName: settings.storeName.trim(), whatsappNumber: settings.whatsappNumber.trim(), lowStockThreshold: settings.lowStockThreshold, orderMessageTemplate: settings.orderMessageTemplate.trim(), contactInfo: { phone: settings.contactInfo.phone?.trim() || null, email: settings.contactInfo.email?.trim() || null, address: settings.contactInfo.address?.trim() || null }, policies: Object.fromEntries(Object.entries(settings.policies).map(([key, value]) => [key, value.trim()])) }; const response = await adminPatch<AdminSettingsResponse>("/api/admin/settings", payload); setSettings(response.item); setNotice("انحفظت إعدادات المتجر."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "تعذّر حفظ الإعدادات."); }
    finally { setSaving(false); }
  };
  if (loading) return <AdminLoading label="نحمّل إعدادات المتجر..." />;
  if (error && !settings) return <AdminError message={error} onRetry={load} />;
  if (!settings) return null;
  const policyKeys = [...new Set([...Object.keys(policyLabels), ...Object.keys(settings.policies)])];
  return <div className="admin-panel-stack"><div className="admin-page-intro"><div><h2>إعدادات المتجر</h2><p>تنعكس الإعدادات المحفوظة على صفحات التواصل والسياسات ورسائل الطلب.</p></div><button className="admin-button admin-button--gold" form="admin-settings-form" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</button></div>{notice ? <p className="admin-success" role="status">{notice}</p> : null}{error ? <p className="admin-alert admin-alert--light" role="alert">{error}</p> : null}<form id="admin-settings-form" className="admin-panel-stack" onSubmit={save}>
    <section className="admin-card admin-form-card"><h3>بيانات المتجر</h3><div className="admin-form-grid"><label className="admin-field admin-field--light">اسم المتجر<input required value={settings.storeName} onChange={(event) => setSettings({ ...settings, storeName: event.target.value })} /></label><label className="admin-field admin-field--light">رقم واتساب<input required dir="ltr" inputMode="tel" value={settings.whatsappNumber} onChange={(event) => setSettings({ ...settings, whatsappNumber: event.target.value })} /><small>مع رمز الدولة، من دون مسافات.</small></label><label className="admin-field admin-field--light">حد تنبيه انخفاض المخزون<input type="number" min="0" step="1" value={settings.lowStockThreshold} onChange={(event) => setSettings({ ...settings, lowStockThreshold: Number(event.target.value) })} /><small>يُستخدم كقيمة افتراضية للأحجام الجديدة.</small></label><label className="admin-field admin-field--light">هاتف التواصل<input dir="ltr" inputMode="tel" value={settings.contactInfo.phone || ""} onChange={(event) => setSettings({ ...settings, contactInfo: { ...settings.contactInfo, phone: event.target.value || null } })} /></label><label className="admin-field admin-field--light">بريد التواصل<input type="email" dir="ltr" value={settings.contactInfo.email || ""} onChange={(event) => setSettings({ ...settings, contactInfo: { ...settings.contactInfo, email: event.target.value || null } })} /></label><label className="admin-field admin-field--light">العنوان<input value={settings.contactInfo.address || ""} onChange={(event) => setSettings({ ...settings, contactInfo: { ...settings.contactInfo, address: event.target.value || null } })} /></label></div></section>
    <section className="admin-card admin-form-card"><div><h3>قالب رسالة الطلب</h3><p className="admin-inline-note">تُستبدل الرموز ببيانات الطلب الحقيقية من الخادم. اترك الرموز كما هي.</p></div><label className="admin-field admin-field--light">نص الرسالة<textarea required rows={9} maxLength={4000} value={settings.orderMessageTemplate} onChange={(event) => setSettings({ ...settings, orderMessageTemplate: event.target.value })} /></label><p className="admin-inline-note">الرموز الإلزامية: {"{storeName}"}, {"{orderNumber}"}, {"{items}"}, {"{subtotal}"}, {"{deliveryNote}"}</p></section>
    <section className="admin-card admin-form-card"><div className="admin-card__heading"><div><h3>السياسات</h3><p className="admin-inline-note">تظهر هذه النصوص للزوار بعد حفظها.</p></div></div>{policyKeys.map((key) => <label className="admin-field admin-field--light" key={key}>{policyLabels[key] || key}<textarea rows={5} value={settings.policies[key] || ""} onChange={(event) => setSettings({ ...settings, policies: { ...settings.policies, [key]: event.target.value } })} placeholder="أدخل النص الذي اعتمده المتجر" /></label>)}</section>
  </form></div>;
}
