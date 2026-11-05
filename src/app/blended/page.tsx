import type { Metadata } from "next";
import { ProductCollection } from "@/components/storefront/ProductCollection";

export const metadata: Metadata = { title: "عطور التركيب", description: "تصفّح عطور التركيب المنشورة في متجر رَشّة." };
export default function BlendedPage() { return <ProductCollection type="blended" title="عطور التركيب" description="تشكيلة من عطور التركيب التي أضافها المتجر، مع خيارات الحجم والسعر لكل عطر." />; }
