import type { Metadata } from "next";
import { CartPage } from "@/components/storefront/CartPage";

export const metadata: Metadata = { title: "سلتك", robots: { index: false, follow: false } };
export default function CartRoute() { return <CartPage />; }
