"use client";

import Link from "next/link";
import { useStorefrontSettings } from "@/lib/storefront-settings";
import { StoreWhatsAppLink } from "@/components/storefront/StoreWhatsAppLink";

const policies: Record<string, { title: string; intro: string; fallback: string }> = {
  privacy: { title: "سياسة الخصوصية", intro: "نستخدم المعلومات التي تدخلها عند مراجعة الطلب لتجهيز الطلب والتواصل بشأنه.", fallback: "لا يحتاج تصفح المتجر إلى إنشاء حساب.\nقد تحفظ تفاصيل الطلب التي ترسلها لإدارة الطلب والتواصل حوله.\nلا تدخل بيانات دفع إلكتروني في الموقع؛ لا توجد بوابة دفع.\nللاستفسار عن معلوماتك أو طلب تعديلها، تواصل مع المتجر عبر واتساب." },
  returns: { title: "سياسة الاستبدال والإرجاع", intro: "تُحدّد تفاصيل الاستبدال أو الإرجاع عند التواصل مع المتجر بشأن الحالة والمنتج.", fallback: "افحص المنتج عند استلامه، وتواصل معنا مباشرة إذا وصل بحالة غير متوقعة.\nتواصل معنا عبر واتساب قبل ترتيب أي استبدال أو إرجاع." },
  delivery: { title: "الطلبات والتوصيل", intro: "التوصيل يتم بواسطة المتجر، وتأكيد الطلب يكون عبر واتساب.", fallback: "الموقع لا يضيف رسوم التوصيل إلى إجمالي المنتجات.\nتُحدّد تكلفة التوصيل وتفاصيله عبر واتساب قبل إتمام الترتيب.\nإنشاء الطلب في الموقع لا يعني أن رسالة واتساب أُرسلت أو أن الطلب تأكد." },
  terms: { title: "شروط الاستخدام", intro: "باستخدام المتجر، يمكنك استعراض المنتجات وإضافة اختياراتك إلى السلة ومراجعة الطلب.", fallback: "تُعرض الأسعار والمخزون بحسب البيانات المتاحة وقت الطلب، ويعاد التحقق منها على الخادم.\nلا يتم الدفع داخل الموقع؛ يُستكمل التواصل والتأكيد عبر واتساب.\nفتح واتساب لا يعني وحده أن الرسالة أُرسلت أو أن الطلب تأكد." },
};

export function PolicyContent({ slug }: { slug: string }) {
  const { settings } = useStorefrontSettings();
  const policy = policies[slug];
  if (!policy) return <section className="content-container empty-state"><h1>هذه الصفحة غير متاحة</h1><Link className="button button--outline" href="/">العودة للرئيسية</Link></section>;
  const saved = settings.policies[slug] || (slug === "delivery" ? settings.policies.shipping : "");
  const paragraphs = (saved || policy.fallback).split(/\n+/).map((part) => part.trim()).filter(Boolean);
  return <article className="content-container prose-page"><p className="eyebrow">معلومات {settings.storeName}</p><h1>{policy.title}</h1>{policy.intro ? <p>{policy.intro}</p> : null}<div className="policy-custom-text">{paragraphs.map((part, index) => <p key={index}>{part}</p>)}</div><StoreWhatsAppLink className="text-link">تواصل معنا عبر واتساب <span aria-hidden="true">↗</span></StoreWhatsAppLink></article>;
}
