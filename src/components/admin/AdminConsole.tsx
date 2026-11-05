"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AdminApiError, adminGet } from "@/lib/admin-api";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";

interface AdminMe { userId: string; displayName: string | null; }
export type AdminTab = "overview" | "products" | "orders" | "inventory" | "reviews" | "content" | "settings" | "logs";

const navigation: { id: AdminTab; label: string; icon: string }[] = [
  { id: "overview", label: "نظرة عامة", icon: "◫" },
  { id: "products", label: "المنتجات", icon: "◇" },
  { id: "orders", label: "الطلبات", icon: "▤" },
  { id: "inventory", label: "المخزون", icon: "▧" },
  { id: "reviews", label: "التقييمات", icon: "☆" },
  { id: "content", label: "محتوى الموقع", icon: "▣" },
  { id: "settings", label: "الإعدادات", icon: "⚙" },
  { id: "logs", label: "سجل النشاط", icon: "≡" },
];

let browserClient: SupabaseClient | null = null;
function getBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("إعداد اتصال Supabase غير مكتمل. أضف NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY إلى ملف البيئة.");
  browserClient ??= createBrowserClient(url, anonKey);
  return browserClient;
}

export function AdminConsole() {
  const [user, setUser] = useState<AdminMe | null>(null);
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<AdminTab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const verify = useCallback(async () => {
    setChecking(true);
    setDenied(false);
    setLoadError("");
    try {
      const me = await adminGet<AdminMe>("/api/admin/me");
      setUser(me);
    } catch (cause) {
      setUser(null);
      if (cause instanceof AdminApiError && cause.status === 403) setDenied(true);
      else if (!(cause instanceof AdminApiError) || cause.status !== 401) setLoadError(cause instanceof Error ? cause.message : "تعذّر التحقق من الدخول.");
    } finally { setChecking(false); }
  }, []);

  useEffect(() => { void verify(); }, [verify]);

  const logout = async () => {
    try { await getBrowserClient().auth.signOut(); } catch { /* The server session still gets checked on the next visit. */ }
    setUser(null);
    setDenied(false);
  };

  if (checking) return <div className="admin-gate" role="status">جارٍ التحقق من صلاحية الدخول...</div>;
  if (denied) return <div className="admin-gate"><div className="admin-gate__card"><span className="admin-brand-mark">ر</span><p className="eyebrow">إدارة رَشّة</p><h1>هذا الحساب غير مخوّل</h1><p>لا يملك الحساب الحالي صلاحية إدارة المتجر. استخدم حساب المدير المصرّح به.</p><button className="admin-button admin-button--secondary" type="button" onClick={logout}>تسجيل الخروج</button></div></div>;
  if (!user) return <AdminLogin error={loadError} onSignedIn={verify} />;

  return <div className="admin-layout" dir="rtl">
    <aside className={`admin-sidebar${menuOpen ? " admin-sidebar--open" : ""}`}>
      <div className="admin-sidebar__brand"><span className="admin-brand-mark">ر</span><div><strong>رَشّة</strong><small>لوحة الإدارة</small></div></div>
      <nav aria-label="قائمة الإدارة">{navigation.map((item) => <button type="button" key={item.id} className={tab === item.id ? "admin-nav-item is-active" : "admin-nav-item"} onClick={() => { setTab(item.id); setMenuOpen(false); }}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>
      <div className="admin-sidebar__bottom"><button type="button" className="admin-back-store" onClick={() => window.location.assign("/")}>↖ عرض المتجر</button><button type="button" className="admin-signout" onClick={logout}>تسجيل الخروج</button></div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar"><button type="button" className="admin-menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label="القائمة">☰</button><div><span className="admin-topbar__eyebrow">لوحة رَشّة</span><h1>{navigation.find((item) => item.id === tab)?.label}</h1></div><span className="admin-user">{user.displayName || "المدير"}<i>●</i></span></header>
      <main className="admin-workspace" id="main-content"><AdminWorkspace tab={tab} /></main>
    </div>
  </div>;
}

function AdminLogin({ error, onSignedIn }: { error: string; onSignedIn: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(error);
  const [envError, setEnvError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    setEnvError("");
    try {
      const client = getBrowserClient();
      const result = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw new Error("تعذّر تسجيل الدخول. راجع البريد وكلمة المرور.");
      await onSignedIn();
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("إعداد اتصال Supabase")) setEnvError(cause.message);
      else setNotice(cause instanceof Error ? cause.message : "تعذّر تسجيل الدخول.");
    } finally { setBusy(false); setPassword(""); }
  };

  return <div className="admin-login" dir="rtl"><div className="admin-login__art"><span className="admin-login__orb" /><span className="admin-login__letter">رَ</span><span className="admin-login__caption">RASHA · إدارة المتجر</span></div><form className="admin-login__form" onSubmit={submit}><span className="admin-brand-mark">ر</span><p className="eyebrow">مساحة خاصة</p><h1>أهلاً بعودتك</h1><p className="admin-muted">سجّل الدخول بحساب المدير للوصول إلى المتجر.</p><label className="admin-field">البريد الإلكتروني<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label><label className="admin-field">كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>{notice ? <p className="admin-alert" role="alert">{notice}</p> : null}{envError ? <p className="admin-alert" role="alert">{envError}</p> : null}<button className="admin-button admin-button--gold" type="submit" disabled={busy}>{busy ? "جارٍ التحقق..." : "تسجيل الدخول"}<span aria-hidden="true">←</span></button><p className="admin-login__note">الدخول متاح لحساب المدير المصرّح فقط.</p></form></div>;
}
