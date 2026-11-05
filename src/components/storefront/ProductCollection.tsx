"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Reveal, RevealGroup } from "@/components/design";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Category, Product, ProductSort, ProductType } from "@/lib/contracts/storefront";
import { getCategories, getProducts } from "@/lib/storefront-api";

const PAGE_SIZE = 12;
const sorts: ProductSort[] = ["newest", "price_asc", "price_desc"];

export function ProductCollection({ type, title, description }: { type?: ProductType; title: string; description?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [scentFamilies, setScentFamilies] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<ProductSort>("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [brandId, setBrandId] = useState("");
  const [scentFamily, setScentFamily] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearchInput(params.get("q") || "");
    setCategory(params.get("category") || "");
    const urlSort = params.get("sort") as ProductSort | null;
    if (urlSort && sorts.includes(urlSort)) setSort(urlSort);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { void getCategories().then(setCategories).catch(() => setCategories([])); }, []);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    const requestId = ++requestSequence.current;
    setError("");
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const result = await getProducts({
        productType: type,
        search: search || undefined,
        categorySlug: category || undefined,
        brandId: brandId || undefined,
        scentFamily: scentFamily || undefined,
        sort,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      if (requestId !== requestSequence.current) return;
      setProducts((current) => append ? [...current, ...result.items] : result.items);
      setBrands(result.facets.brands);
      setScentFamilies(result.facets.scentFamilies);
      setPage(result.pagination.page);
      setTotal(result.pagination.total);
      setHasMore(result.pagination.hasMore);
    } catch (cause) {
      if (requestId !== requestSequence.current) return;
      setError(cause instanceof Error ? cause.message : "تعذّر تحميل العطور الآن.");
      if (!append) setProducts([]);
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [type, search, category, brandId, scentFamily, sort]);

  useEffect(() => { void load(1, false); }, [load]);

  return <section className="collection-page content-container">
    <div className="collection-heading">
      <div><p className="eyebrow">مجموعة رَشّة</p><h1>{title}</h1>{description ? <p className="section-description">{description}</p> : null}</div>
      <span className="collection-count">{loading ? "..." : `${total} عطر`}</span>
    </div>
    <div className="collection-filters" aria-label="تصفية العطور">
      <label className="search-field"><span className="sr-only">ابحث داخل هذه المجموعة</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="ابحث عن عطر..." /><span aria-hidden="true">⌕</span></label>
      <label className="select-field"><span className="sr-only">الترتيب</span><select value={sort} onChange={(event) => setSort(event.target.value as ProductSort)}><option value="newest">الأحدث</option><option value="price_asc">السعر: الأقل أولاً</option><option value="price_desc">السعر: الأعلى أولاً</option></select></label>
      {categories.length ? <label className="select-field"><span className="sr-only">القسم</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">كل الأقسام</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label> : null}
      {brands.length ? <label className="select-field"><span className="sr-only">الماركة</span><select value={brandId} onChange={(event) => setBrandId(event.target.value)}><option value="">كل الماركات</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
      {scentFamilies.length ? <label className="select-field"><span className="sr-only">العائلة العطرية</span><select value={scentFamily} onChange={(event) => setScentFamily(event.target.value)}><option value="">كل العائلات</option>{scentFamilies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : null}
    </div>
    {error ? <div className="inline-alert" role="alert"><p>{error}</p><button className="button button--quiet" onClick={() => void load(1, false)}>حاول مجدداً</button></div> : null}
    {loading ? <div className="loading-line" role="status">نفتح لك الرفوف...</div> : products.length ? <>
      <RevealGroup className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</RevealGroup>
      {hasMore ? <div className="load-more"><button className="button button--outline" disabled={loadingMore} onClick={() => void load(page + 1, true)}>{loadingMore ? "جارٍ التحميل..." : "اعرض المزيد"}</button></div> : null}
    </> : !error ? <Reveal as="section" className="empty-state"><span className="empty-state__mark">✦</span><h2>{search ? "ما لقينا عطر بهالكلمات" : "لا توجد عطور منشورة هنا بعد"}</h2><p>{search ? "جرّب اسماً أقصر أو كلمة مختلفة." : "ستظهر المنتجات هنا عندما يضيفها المتجر. جرّب مجموعة أخرى أو ارجع لاحقاً."}</p><Link className="button button--outline" href="/">العودة للرئيسية</Link></Reveal> : null}
  </section>;
}
