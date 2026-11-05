import type { Metadata } from "next";
import { StoreWhatsAppLink } from "@/components/storefront/StoreWhatsAppLink";

export const metadata: Metadata = { title: "اتصل بنا", description: "تواصل مع متجر رَشّة في قطاع غزة." };
export default function ContactPage() {
  return <section className="content-container prose-page"><p className="eyebrow">نحن قريبون</p><h1>اتصل بنا</h1><p>للاستفسار عن العطور أو متابعة طلبك، تواصل معنا عبر واتساب. نرتّب معك تفاصيل التوصيل هناك.</p><StoreWhatsAppLink className="button button--gold">تواصل عبر واتساب <span aria-hidden="true">↗</span></StoreWhatsAppLink></section>;
}
