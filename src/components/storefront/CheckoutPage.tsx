"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { createOrder, StorefrontApiError } from "@/lib/storefront-api";
import { useCart } from "@/lib/cart-context";
import { formatIls, toMinorUnits } from "@/lib/money";
import type { CreateOrderResponse } from "@/lib/contracts/storefront";

const SESSION_ORDER_KEY = "rasha-latest-order-v1";
type SavedOrder = CreateOrderResponse & { cartSignature: string };

function signatureFor(lines: { variantId: string; quantity: number }[]) {
  return JSON.stringify([...lines].map(({ variantId, quantity }) => ({ variantId, quantity })).sort((a, b) => a.variantId.localeCompare(b.variantId)));
}

function readSavedOrder(): SavedOrder | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(SESSION_ORDER_KEY) || "null");
    return value && typeof value === "object" && "whatsappUrl" in value && "cartSignature" in value ? value as SavedOrder : null;
  } catch { return null; }
}

export function CheckoutPage() {
  const { lines, ready, subtotal } = useCart();
  const signature = useMemo(() => signatureFor(lines), [lines]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<SavedOrder | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const keyRef = useRef<{ signature: string; key: string } | null>(null);

  if (!ready) return <div className="content-container loading-line" role="status">نجهّز مراجعة الطلب...</div>;
  if (!lines.length && !order) return <section className="content-container empty-state"><span className="empty-state__mark">✦</span><h1>سلتك فارغة</h1><p>أضف عطراً إلى السلة قبل مراجعة الطلب.</p><Link className="button button--gold" href="/original">تصفّح العطور</Link></section>;

  const currentOrder = order || readSavedOrder();
  const existingOrder = currentOrder?.cartSignature === signature ? currentOrder : null;

  const openWhatsApp = (url: string) => {
    const popup = window.open(url, "_blank");
    if (popup) popup.opener = null;
    setOpenFailed(!popup);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length || submitting) return;
    setSubmitting(true);
    setError("");
    setOpenFailed(false);
    // Open a blank tab synchronously to avoid popup blocking after the server round-trip.
    const popup = window.open("about:blank", "_blank");
    const key = keyRef.current?.signature === signature ? keyRef.current.key : (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    keyRef.current = { signature, key };
    try {
      const created = await createOrder({
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        idempotencyKey: key,
        ...(name.trim() ? { customerName: name.trim() } : {}),
        ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      const saved = { ...created, cartSignature: signature };
      setOrder(saved);
      try { window.sessionStorage.setItem(SESSION_ORDER_KEY, JSON.stringify(saved)); } catch { /* The confirmation stays available in memory. */ }
      if (popup && !popup.closed) {
        popup.location.href = created.whatsappUrl;
        popup.opener = null;
      } else setOpenFailed(true);
    } catch (cause) {
      if (popup && !popup.closed) popup.close();
      const message = cause instanceof Error ? cause.message : "تعذّر حفظ الطلب. بقيت سلتك كما هي؛ حاول مرة أخرى.";
      setError(cause instanceof StorefrontApiError && cause.status === 409 ? `${message} راجع الكميات المتاحة في سلتك.` : message);
      // Keep the same idempotency key for a retry with this exact cart.
    } finally { setSubmitting(false); }
  }

  if (existingOrder) return <section className="content-container order-created" aria-live="polite">
    <div className="order-created__mark" aria-hidden="true">✓</div><p className="eyebrow">رقم الطلب {existingOrder.orderNumber}</p><h1>تم إنشاء طلبك</h1><p>الطلب محفوظ لدى المتجر، ويمكنك الآن متابعة إرساله عبر واتساب. فتح واتساب وحده لا يعني أن الرسالة أُرسلت.</p>
    <button className="button button--gold" type="button" onClick={() => openWhatsApp(existingOrder.whatsappUrl)}>افتح واتساب لإكمال الطلب <span aria-hidden="true">↗</span></button>
    {openFailed ? <p className="inline-help">ما فتح واتساب تلقائياً. استخدم الزر أعلاه مرة ثانية أو افتح الرابط في نافذة جديدة.</p> : null}
    <Link className="text-link order-back-link" href="/cart">ارجع إلى سلتك</Link>
  </section>;

  return <section className="content-container checkout-page">
    <div className="collection-heading"><div><p className="eyebrow">الخطوة الأخيرة</p><h1>مراجعة الطلب</h1><p className="section-description">راجع العطور والأحجام والكميات قبل إنشاء الطلب.</p></div><Link className="text-link" href="/cart">تعديل السلة</Link></div>
    <div className="checkout-layout">
      <form className="checkout-form" onSubmit={submit}>
        <div className="checkout-panel"><h2>معلومات التواصل <span>اختياري</span></h2><label className="form-field">الاسم<input autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="اسمك" /></label><label className="form-field">رقم الهاتف<input autoComplete="tel" inputMode="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="للتواصل حول التوصيل" /></label><label className="form-field">ملاحظة للمتجر<textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="أي تفاصيل تساعدنا في تجهيز طلبك" /></label></div>
        {error ? <div className="inline-alert" role="alert"><p>{error}</p><Link className="text-link" href="/cart">راجع السلة</Link></div> : null}
        <button className="button button--gold checkout-submit" type="submit" disabled={submitting || !lines.length}>{submitting ? "جارٍ حفظ الطلب..." : "أنشئ الطلب وافتح واتساب"}<span aria-hidden="true">↗</span></button>
        <p className="checkout-assurance">لن نخصم أي مبلغ داخل الموقع. لن تُرسل رسالة واتساب تلقائياً من دون إكمالها في التطبيق.</p>
      </form>
      <aside className="order-summary checkout-summary"><p className="eyebrow">تفاصيل طلبك</p><div className="checkout-items">{lines.map((line) => <div className="checkout-item" key={line.variantId}><div className="checkout-item__image">{line.imageUrl ? <Image src={line.imageUrl} alt="" width={72} height={72} unoptimized /> : <span>ر</span>}</div><div><strong>{line.productName}</strong><small>{line.productType === "original" ? "عطر أصلي" : "عطر تركيب"} · {line.sizeLabel} × {line.quantity}</small></div><b>{formatIls(toMinorUnits(line.unitPrice) * line.quantity)}</b></div>)}</div><div className="summary-row"><span>إجمالي المنتجات</span><strong>{formatIls(subtotal)}</strong></div><p className="delivery-note">تكلفة التوصيل تُحدّد عبر واتساب ولا تدخل في الإجمالي أعلاه.</p></aside>
    </div>
  </section>;
}
