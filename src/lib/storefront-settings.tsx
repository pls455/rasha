"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getStorefrontSettings } from "@/lib/storefront-api";

const DEFAULT_PHONE = "972598264288";
const EMPTY_CONTACT = { phone: null, email: null, address: null };
type StoreSettings = { storeName: string; whatsappNumber: string; policies: Record<string, string>; contactInfo: { phone: string | null; email: string | null; address: string | null } };
const StorefrontSettingsContext = createContext<{ settings: StoreSettings; loaded: boolean }>({ settings: { storeName: "رَشّة", whatsappNumber: DEFAULT_PHONE, policies: {}, contactInfo: EMPTY_CONTACT }, loaded: false });

export function StorefrontSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>({ storeName: "رَشّة", whatsappNumber: DEFAULT_PHONE, policies: {}, contactInfo: EMPTY_CONTACT });
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await getStorefrontSettings();
      setSettings({ storeName: data.storeName || "رَشّة", whatsappNumber: data.whatsappNumber || DEFAULT_PHONE, policies: data.policies || {}, contactInfo: data.contactInfo || EMPTY_CONTACT });
    } catch { /* Keep safe public defaults while the store settings are unavailable. */ }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const value = useMemo(() => ({ settings, loaded }), [settings, loaded]);
  return <StorefrontSettingsContext.Provider value={value}>{children}</StorefrontSettingsContext.Provider>;
}

export function useStorefrontSettings() { return useContext(StorefrontSettingsContext); }
export function whatsappHref(phone: string) { const digits = phone.replace(/\D/g, ""); return digits ? `https://wa.me/${digits}` : ""; }
