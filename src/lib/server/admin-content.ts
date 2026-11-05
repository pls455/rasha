import "server-only";
import type { AdminContentData } from "@/lib/contracts/admin";
import type { AdminProduct } from "@/lib/contracts/admin";
import { mapAdminProduct } from "@/lib/server/admin-data";
import { createSupabaseServiceClient } from "@/lib/server/supabase/client";

interface Row { [key: string]: unknown }
const object = (value: unknown): Record<string, unknown> | null => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const records = (value: unknown): Row[] => Array.isArray(value) ? value.map((row) => object(row) ?? {}) : [];

const ADMIN_PRODUCT_SELECT = `id,name,slug,description,product_type,brand_id,category_id,scent_family,notes,origin_country,is_published,is_featured,is_best_seller,display_order,created_at,brand:brands(id,name,description,logo_url,is_active),category:categories(id,name,slug,description,image_url,is_active,display_order),images:product_images(id,image_url,alt_text,display_order,is_primary),variants:product_variants(id,product_id,size_label,price,compare_at_price,stock_quantity,low_stock_threshold,is_active)`;

async function loadAdminProducts(ids: string[]): Promise<AdminProduct[]> {
  if (!ids.length) return [];
  const { data, error } = await createSupabaseServiceClient().from("products").select(ADMIN_PRODUCT_SELECT).in("id", ids);
  if (error) throw new Error("ADMIN_CONTENT_PRODUCTS_FAILED");
  const items = (data ?? []).map(mapAdminProduct);
  const positions = new Map(ids.map((id, index) => [id, index]));
  return items.sort((a, b) => (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

export async function getAdminContent(): Promise<AdminContentData> {
  const supabase = createSupabaseServiceClient();
  const [settings, banners, sections] = await Promise.all([
    supabase.from("site_settings").select("key,value,is_public").in("key", ["home_hero", "promo_bar"]),
    supabase.from("banners").select("id,title,description,image_url,link_url,is_active,display_order").order("display_order", { ascending: true }),
    supabase.from("site_sections").select("id,section_key,title,description,is_active,display_order,settings,section_products:site_section_products(product_id,display_order)").order("display_order", { ascending: true }),
  ]);
  if (settings.error || banners.error || sections.error) throw new Error("ADMIN_CONTENT_READ_FAILED");
  const values = new Map((settings.data ?? []).map((row) => [row.key, { value: object(row.value) ?? {}, isPublic: row.is_public }]));
  const rawHero = values.get("home_hero")?.value;
  const hero = rawHero ? {
    title: typeof rawHero.title === "string" ? rawHero.title : null,
    description: typeof rawHero.description === "string" ? rawHero.description : null,
    imageUrl: typeof rawHero.imageUrl === "string" ? rawHero.imageUrl : null,
    ctaLabel: typeof rawHero.ctaLabel === "string" ? rawHero.ctaLabel : null,
    ctaUrl: typeof rawHero.ctaUrl === "string" ? rawHero.ctaUrl : null,
    isActive: rawHero.isActive !== false,
  } : null;
  const promoSetting = values.get("promo_bar");
  const rawPromo = promoSetting?.value;
  const promoBar = rawPromo ? {
    text: typeof rawPromo.text === "string" ? rawPromo.text : "",
    linkUrl: typeof rawPromo.linkUrl === "string" ? rawPromo.linkUrl : null,
    isActive: promoSetting?.isPublic === true,
  } : null;
  const sectionRows = (sections.data ?? []).map((row) => ({
    row,
    links: records(row.section_products).sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0)),
  }));
  const productIds = [...new Set(sectionRows.flatMap(({ links }) => links.map((link) => String(link.product_id ?? "")).filter(Boolean)))];
  const products = await loadAdminProducts(productIds);
  const productsById = new Map(products.map((product) => [product.id, product]));
  return {
    hero,
    promoBar,
    banners: (banners.data ?? []).map((row) => ({
      id: row.id, title: row.title, description: row.description, imageUrl: row.image_url,
      linkUrl: row.link_url, displayOrder: row.display_order, isActive: row.is_active,
    })),
    sections: sectionRows.map(({ row, links }) => {
      const productIds = links.map((link) => String(link.product_id ?? "")).filter((id) => productsById.has(id));
      return {
        id: row.id, sectionKey: row.section_key, title: row.title, description: row.description,
        displayOrder: row.display_order, isActive: row.is_active,
        settings: object(row.settings) ?? {}, productIds,
        products: productIds.map((id) => productsById.get(id)).filter((product): product is AdminProduct => product !== undefined),
      };
    }),
  };
}
