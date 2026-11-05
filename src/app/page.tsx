import type { Metadata } from "next";
import { StorefrontHome } from "@/components/storefront/StorefrontHome";

export const metadata: Metadata = { title: "عطرك... بصمتك الخاصة", description: "تصفّح العطور الأصلية وعطور التركيب من رَشّة في قطاع غزة." };

export default function HomePage() { return <StorefrontHome />; }
