import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "@/styles/rasha-design.css";
import "./globals.css";
import { StorefrontShell } from "@/components/storefront/StorefrontShell";

const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal", display: "swap" });

export const metadata: Metadata = {
  title: { default: "رَشّة | RASHA — عطرك بصمتك الخاصة", template: "%s | رَشّة" },
  description: "اكتشف العطور الأصلية وعطور التركيب من رَشّة، والتوصيل داخل قطاع غزة.",
  openGraph: { title: "رَشّة | RASHA", description: "عطرك... بصمتك الخاصة", locale: "ar_PS", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" className={tajawal.variable}>
    <body><a href="#main-content" className="skip-link">تجاوز إلى المحتوى</a><StorefrontShell>{children}</StorefrontShell></body>
  </html>;
}
