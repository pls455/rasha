import type { Metadata } from "next";
import { CheckoutPage } from "@/components/storefront/CheckoutPage";

export const metadata: Metadata = { title: "مراجعة الطلب", robots: { index: false, follow: false } };
export default function CheckoutRoute() { return <CheckoutPage />; }
