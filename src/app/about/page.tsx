import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "من نحن", description: "عن رَشّة، متجر العطور في قطاع غزة." };
export default function AboutPage() {
  return <section className="content-container prose-page"><p className="eyebrow">حكاية رَشّة</p><h1>عطور تختارها بقلبك</h1><p>رَشّة مساحة لاكتشاف العطور الأصلية وعطور التركيب. نعرض هنا المنتجات وتفاصيلها كما يضيفها المتجر، من دون افتراض معلومات غير متاحة.</p><p>خدمتنا مخصصة لعملائنا في قطاع غزة، ويُستكمل تأكيد الطلب وتفاصيل التوصيل عبر واتساب.</p><Link className="button button--outline" href="/search">اكتشف العطور</Link></section>;
}
