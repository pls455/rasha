"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/design";
import { useCart } from "@/lib/cart-context";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/original", label: "العطور الأصلية" },
  { href: "/blended", label: "عطور التركيب" },
  { href: "/search", label: "اكتشف عطرك" },
];

export function SiteHeader() {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <button className="icon-button site-header__menu" type="button" aria-label="فتح القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <span className="menu-glyph" aria-hidden="true"><i /><i /><i /></span>
        </button>
        <BrandMark className="site-header__brand" />
        <nav className="desktop-nav" aria-label="القائمة الرئيسية">
          {links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}
        </nav>
        <div className="site-header__actions">
          <Link className="icon-button search-shortcut" href="/search" aria-label="البحث">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7" /><path d="m16 16 4.2 4.2" /></svg>
          </Link>
          <Link className="icon-button cart-shortcut" href="/cart" aria-label={`السلة، ${itemCount} منتجات`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.7 10.1a2 2 0 0 0 2 1.7h7.5a2 2 0 0 0 1.9-1.4L21 9H7" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>
            {itemCount > 0 ? <span className="cart-count">{itemCount > 99 ? "99+" : itemCount}</span> : null}
          </Link>
        </div>
      </div>
      {menuOpen ? <nav className="mobile-menu" aria-label="قائمة الهاتف">
        {links.map((link) => <Link href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}
        <Link href="/cart" onClick={() => setMenuOpen(false)}>السلة ({itemCount})</Link>
      </nav> : null}
    </header>
  );
}
