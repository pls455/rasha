import type { Metadata } from "next";
import { ProductDetailPage } from "@/components/storefront/ProductDetailPage";

export const metadata: Metadata = { title: "تفاصيل العطر", description: "تفاصيل العطور المتاحة في متجر رَشّة." };
export default function ProductPage() { return <ProductDetailPage />; }
