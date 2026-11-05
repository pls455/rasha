import type { Metadata } from "next";
import { ProductCollection } from "@/components/storefront/ProductCollection";

export const metadata: Metadata = { title: "اكتشف عطرك", description: "ابحث عن العطور المنشورة في متجر رَشّة وصفّها حسب السعر أو النوع." };
export default function SearchPage() { return <ProductCollection title="اكتشف عطرك" description="ابحث في المنتجات المنشورة من المتجر. تتم قراءة النتائج من قاعدة البيانات، ولا نعرض منتجات غير مسجلة." />; }
