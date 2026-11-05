import type { Metadata } from "next";
import { PolicyContent } from "@/components/storefront/PolicyContent";

const policyTitles: Record<string, string> = {
  privacy: "سياسة الخصوصية",
  returns: "سياسة الاستبدال والإرجاع",
  delivery: "الطلبات والتوصيل",
  terms: "شروط الاستخدام",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: policyTitles[slug] || "السياسات" };
}

export async function generateStaticParams() { return Object.keys(policyTitles).map((slug) => ({ slug })); }

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PolicyContent slug={slug} />;
}
