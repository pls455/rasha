"use client";

import Link from "next/link";
import { BrandMark } from "@/components/design";
import { useCart } from "@/lib/cart-context";
import { useStorefrontSettings, whatsappHref } from "@/lib/storefront-settings";

export function MobileBottomNav() {
  const { itemCount } = useCart();
  return <nav className="mobile-bottom-nav" aria-label="التنقل السريع">
    <Link href="/" aria-label="الرئيسية"><span aria-hidden="true">⌂</span><small>الرئيسية</small></Link>
    <Link href="/original" aria-label="الأقسام"><span aria-hidden="true">◈</span><small>الأقسام</small></Link>
    <Link href="/search" aria-label="البحث"><span aria-hidden="true">⌕</span><small>البحث</small></Link>
    <Link href="/cart" aria-label={`السلة ${itemCount}`}><span aria-hidden="true">♧</span><small>السلة{itemCount ? ` (${itemCount})` : ""}</small></Link>
  </nav>;
}

export function SiteFooter() {
  const { settings } = useStorefrontSettings();
  const contactUrl = whatsappHref(settings.whatsappNumber);
  return <footer className="site-footer">
    <div className="site-footer__top">
      <div className="site-footer__brand">
        <BrandMark tagline="عطور تختارها بقلبك" />
        <p>مساحة هادئة لاكتشاف رائحة تشبهك.</p>
      </div>
      <div className="site-footer__links">
        <div><h3>تصفّح</h3><Link href="/original">العطور الأصلية</Link><Link href="/blended">عطور التركيب</Link><Link href="/search">البحث</Link></div>
        <div><h3>معلومات</h3><Link href="/about">من نحن</Link><Link href="/contact">اتصل بنا</Link><Link href="/policies/delivery">الطلبات والتوصيل</Link><Link href="/policies/returns">الاستبدال والإرجاع</Link></div>
        <div><h3>تواصل</h3>{settings.contactInfo.phone ? <a href={`tel:${settings.contactInfo.phone}`} dir="ltr">{settings.contactInfo.phone}</a> : null}{settings.contactInfo.email ? <a href={`mailto:${settings.contactInfo.email}`} dir="ltr">{settings.contactInfo.email}</a> : null}{settings.contactInfo.address ? <span>{settings.contactInfo.address}</span> : null}</div>
      </div>
    </div>
    <div className="site-footer__bottom"><span>© {new Date().getFullYear()} {settings.storeName}</span><Link href="/policies/privacy">سياسة الخصوصية</Link><Link href="/policies/terms">شروط الاستخدام</Link>{contactUrl ? <a href={contactUrl} target="_blank" rel="noreferrer">تواصل عبر واتساب</a> : null}</div>
  </footer>;
}
