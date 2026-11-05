"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatIls, toMinorUnits } from "@/lib/money";

export function CartPage() {
  const { lines, ready, subtotal, setQuantity, changeVariant, remove } = useCart();
  if (!ready) return <div className="content-container loading-line" role="status">نفتح سلتك...</div>;
  if (!lines.length) return <section className="content-container empty-state cart-empty"><span className="empty-state__mark">✦</span><h1>سلتك تنتظر عطرك</h1><p>تصفّح العطور وأضف ما يعجبك. ما في تسجيل حساب مطلوب.</p><Link className="button button--gold" href="/original">تصفّح العطور</Link></section>;

  return <section className="content-container cart-page">
    <div className="collection-heading"><div><p className="eyebrow">مراجعة الاختيارات</p><h1>سلتك</h1><p className="section-description">تأكّد من العطور والأحجام قبل الانتقال إلى مراجعة الطلب.</p></div><span className="collection-count">{lines.reduce((sum, line) => sum + line.quantity, 0)} منتج</span></div>
    <div className="cart-layout">
      <div className="cart-lines">{lines.map((line) => <article className="cart-line" key={line.variantId}>
        <Link href={`/product/${encodeURIComponent(line.productSlug)}`} className="cart-line__image">{line.imageUrl ? <Image src={line.imageUrl} alt={line.productName} width={180} height={180} unoptimized /> : <span>رَشّة</span>}</Link>
        <div className="cart-line__content"><div><p className="product-card__eyebrow">{line.productType === "original" ? "عطر أصلي" : "عطر تركيب"}</p><h2><Link href={`/product/${encodeURIComponent(line.productSlug)}`}>{line.productName}</Link></h2>{line.variants.length > 1 ? <label className="cart-line__size-select">الحجم<select value={line.variantId} onChange={(event) => changeVariant(line.variantId, event.target.value).ok && undefined}>{line.variants.filter((variant) => variant.isActive).map((variant) => <option key={variant.id} value={variant.id} disabled={variant.stockQuantity < 1}>{variant.sizeLabel} · {formatIls(variant.price)}{variant.stockQuantity < 1 ? " · غير متوفر" : ""}</option>)}</select></label> : <p className="muted">الحجم: {line.sizeLabel}</p>}</div><div className="cart-line__actions"><div className="quantity-picker" aria-label={`كمية ${line.productName}`}><button type="button" aria-label="زيادة الكمية" disabled={line.quantity >= line.stockQuantity} onClick={() => setQuantity(line.variantId, line.quantity + 1)}>+</button><span>{line.quantity}</span><button type="button" aria-label="تقليل الكمية" disabled={line.quantity <= 1} onClick={() => setQuantity(line.variantId, line.quantity - 1)}>−</button></div><button type="button" className="remove-button" onClick={() => remove(line.variantId)}>إزالة</button></div></div>
        <div className="cart-line__price"><span>{formatIls(line.unitPrice)}</span><strong>{formatIls(toMinorUnits(line.unitPrice) * line.quantity)}</strong></div>
      </article>)}</div>
      <aside className="order-summary"><p className="eyebrow">ملخص السلة</p><div className="summary-row"><span>إجمالي المنتجات</span><strong>{formatIls(subtotal)}</strong></div><p className="delivery-note">تكلفة التوصيل تُحدد عبر واتساب، ولا تدخل في الإجمالي أعلاه.</p><Link className="button button--gold summary-button" href="/checkout">تابع لمراجعة الطلب <span aria-hidden="true">←</span></Link><Link className="text-link" href="/original">أضف عطوراً أخرى</Link></aside>
    </div>
  </section>;
}
