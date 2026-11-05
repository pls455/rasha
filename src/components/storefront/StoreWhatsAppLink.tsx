"use client";

import { useStorefrontSettings, whatsappHref } from "@/lib/storefront-settings";
import type { ReactNode } from "react";

export function StoreWhatsAppLink({ children, className }: { children: ReactNode; className?: string }) {
  const { settings } = useStorefrontSettings();
  const href = whatsappHref(settings.whatsappNumber);
  if (!href) return null;
  return <a className={className} href={href} target="_blank" rel="noreferrer">{children}</a>;
}
