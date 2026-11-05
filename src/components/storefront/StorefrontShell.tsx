"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CinematicIntro } from "@/components/design";
import { SiteHeader } from "@/components/storefront/SiteHeader";
import { MobileBottomNav, SiteFooter } from "@/components/storefront/SiteChrome";
import { CartProvider } from "@/lib/cart-context";
import { StorefrontSettingsProvider } from "@/lib/storefront-settings";

export function StorefrontShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  return <CartProvider>{isAdmin ? children : <StorefrontSettingsProvider>
    <CinematicIntro />
    <SiteHeader />
    <main id="main-content">{children}</main>
    <SiteFooter />
    <MobileBottomNav />
  </StorefrontSettingsProvider>}</CartProvider>;
}
