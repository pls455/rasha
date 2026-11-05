import type { Metadata } from "next";
import { ProductCollection } from "@/components/storefront/ProductCollection";

export const metadata: Metadata = { title: "العطور الأصلية", description: "تصفّح العطور الأصلية المنشورة في متجر رَشّة." };
export default function OriginalPage() { return <ProductCollection type="original" title="العطور الأصلية" description="عطور أصلية اختيرت لترافق لحظاتك الخاصة. تظهر هنا المنتجات المنشورة والمتاحة من متجر رَشّة." />; }
