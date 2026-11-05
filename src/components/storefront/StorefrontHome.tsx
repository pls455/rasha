"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GoldRule, Reveal, RevealGroup } from "@/components/design";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { ApprovedReviewSummary, Category, HomeBanner, HomeResponse, HomeSection, Product } from "@/lib/contracts/storefront";
import { getCategories, getHome } from "@/lib/storefront-api";

const FALLBACK_HERO_IMAGE = "/assets/optimized/catalog/provided-01.webp";
const FALLBACK_HERO_TITLE = "عطرك... بصمتك الخاصة";
const FALLBACK_HERO_DESCRIPTION = "اكتشف مجموعة مختارة من العطور الأصلية وعطور التركيب، واختر الرائحة التي تعبّر عنك.";

export function StorefrontHome() {
  const [home, setHome] = useState<HomeResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    getHome().then((result) => { if (active) setHome(result); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    getCategories().then((result) => { if (active) setCategories(result); }).catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, []);

  const hero = home?.hero;
  const heroTitle = hero?.title?.trim() || FALLBACK_HERO_TITLE;
  const heroDescription = hero?.description?.trim() || FALLBACK_HERO_DESCRIPTION;
  const heroImage = hero?.imageUrl?.trim() || FALLBACK_HERO_IMAGE;
  const heroButton = hero?.ctaLabel?.trim() || "اكتشف العطور";
  const heroHref = safeHref(hero?.ctaUrl, "/original");
  const orderedSections = [...(home?.sections || [])].sort((a, b) => a.displayOrder - b.displayOrder);

  return <>
    {home?.promoBar ? <PromoBar text={home.promoBar.text} linkUrl={home.promoBar.linkUrl} /> : null}
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__ambient" aria-hidden="true" />
      <div className="hero__copy">
        <motion.p className="eyebrow" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>عطر يترك أثراً</motion.p>
        <GoldRule className="hero__rule" />
        <motion.h1 id="hero-title" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.48, delay: reduceMotion ? 0 : 0.08 }}>{heroTitle}</motion.h1>
        <motion.p className="hero__description" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: reduceMotion ? 0 : 0.14 }}>{heroDescription}</motion.p>
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: reduceMotion ? 0 : 0.2 }}><Link className="button button--gold" href={heroHref}>{heroButton} <span aria-hidden="true">←</span></Link></motion.div>
        <div className="hero__note"><span aria-hidden="true">✦</span> نختار التفاصيل بعناية</div>
      </div>
      <motion.div className="hero__visual" initial={reduceMotion ? false : { opacity: 0.6, x: -14, scale: 0.98 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}>
        <div className="hero__image-glow" aria-hidden="true" />
        <Image src={heroImage} alt="قارورة عطر بإضاءة ذهبية على خلفية داكنة" width={920} height={920} priority sizes="(max-width: 800px) 82vw, 48vw" unoptimized />
        <span className="hero__image-caption">RASHA <i>·</i> عطر يعبّر عنك</span>
      </motion.div>
      <a className="hero__scroll" href="#collections"><span aria-hidden="true">↓</span> اكتشف المجموعة</a>
    </section>

    <section className="trust-strip" aria-label="معلومات المتجر"><div><span>01</span> عطور أصلية وعطور تركيب</div><div><span>02</span> التوصيل داخل قطاع غزة</div><div><span>03</span> إتمام الطلب عبر واتساب</div></section>

    {loadError ? <section className="content-container"><div className="inline-alert" role="alert"><p>تعذّر الاتصال بالمتجر الآن، لذلك لم نعرض منتجات قد لا تكون متاحة.</p><button className="button button--quiet" onClick={() => window.location.reload()}>أعد المحاولة</button></div></section> : null}
    <div id="collections" className="home-collections">
      {orderedSections.map((section) => isReviewSection(section.sectionKey)
        ? <ReviewSection key={section.id} title={section.title} description={section.description} reviews={home?.reviews || []} />
        : <HomeProductSection key={section.id} section={section} loading={loading} />)}
    </div>

    {home?.banners.length ? <section className="campaign-banners content-container" aria-label="عروض المتجر">{[...home.banners].sort((a, b) => a.displayOrder - b.displayOrder).map((banner) => <CampaignBanner banner={banner} key={banner.id} />)}</section> : null}

    <section className="discover-section content-container">
      <Reveal as="section" className="discover-copy"><p className="eyebrow">لكل مزاج حكايته</p><GoldRule /><h2>اكتشف عطرك<br /><span>على مهل</span></h2><p>تصفّح العطور حسب الأقسام المتاحة، واكتشف التفاصيل والنوتات التي أضافها المتجر.</p><Link className="button button--outline" href="/search">ابدأ الاكتشاف</Link></Reveal>
      <div className="category-cards">
        {categories.length ? categories.slice(0, 3).map((category, index) => <Link className={`category-card category-card--${index + 1}`} href={`/search?category=${encodeURIComponent(category.slug)}`} key={category.id}>
          {category.imageUrl ? <Image src={category.imageUrl} alt={category.name} width={620} height={720} loading="lazy" unoptimized /> : <span className="category-card__pattern" aria-hidden="true">✦</span>}
          <span className="category-card__overlay"><small>مجموعة</small><strong>{category.name}</strong><span>تصفّح الآن ←</span></span>
        </Link>) : <div className="category-empty"><span aria-hidden="true">✦</span><p>تظهر الأقسام هنا بعد إضافتها من المتجر.</p></div>}
      </div>
    </section>

    <section className="whatsapp-banner"><div><p className="eyebrow">سهل وبسيط</p><h2>وجدت عطرك؟<br />كمل طلبك على واتساب.</h2><p>لا يوجد دفع إلكتروني داخل الموقع. تكلفة التوصيل تُحدّد عبر واتساب.</p><Link className="button button--gold" href="/cart">راجع سلتك <span aria-hidden="true">←</span></Link></div><span className="whatsapp-banner__ornament" aria-hidden="true">رَ</span></section>
  </>;
}

function isReviewSection(key: string) { return /review|rating|testimonial|feedback|تقييم|آراء/i.test(key); }

function safeHref(value: string | null | undefined, fallback: string) {
  const url = value?.trim();
  if (!url) return fallback;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try { const parsed = new URL(url); return parsed.protocol === "https:" || parsed.protocol === "http:" ? url : fallback; } catch { return fallback; }
}

function PromoBar({ text, linkUrl }: { text: string; linkUrl: string | null }) {
  const safe = safeHref(linkUrl, "");
  return <div className="promo-bar">{safe ? <a href={safe} target={safe.startsWith("/") ? undefined : "_blank"} rel={safe.startsWith("/") ? undefined : "noreferrer"}>{text} <span aria-hidden="true">←</span></a> : <span>{text}</span>}</div>;
}

function CampaignBanner({ banner }: { banner: HomeBanner }) {
  const content = <><Image src={banner.imageUrl} alt={banner.title} width={1200} height={460} loading="lazy" unoptimized /><span className="campaign-banner__shade" /><span className="campaign-banner__copy"><strong>{banner.title}</strong>{banner.description ? <small>{banner.description}</small> : null}</span></>;
  const safe = safeHref(banner.linkUrl, "");
  return safe ? <a className="campaign-banner" href={safe} target={safe.startsWith("/") ? undefined : "_blank"} rel={safe.startsWith("/") ? undefined : "noreferrer"}>{content}</a> : <div className="campaign-banner">{content}</div>;
}

function HomeProductSection({ section, loading }: { section: HomeSection; loading: boolean }) {
  const products = section.products || [];
  const imageUrl = typeof section.settings.imageUrl === "string" ? safeHref(section.settings.imageUrl, "") : "";
  if (!loading && !products.length) return null;
  return <section className="home-product-section">
    <div className="content-container">
      <Reveal as="section" className={`section-heading${imageUrl ? " section-heading--with-image" : ""}`}><div><p className="eyebrow">مختارة لك</p><h2>{section.title}</h2>{section.description ? <p>{section.description}</p> : null}<Link className="text-link" href="/search">استكشف العطور <span aria-hidden="true">←</span></Link></div>{imageUrl ? <Image className="section-heading__image" src={imageUrl} alt={section.title} width={540} height={280} loading="lazy" unoptimized /> : null}</Reveal>
      {loading ? <div className="skeleton-grid" aria-label="تحميل العطور"><span /><span /><span /><span /></div> : <RevealGroup className="product-grid">{products.map((product: Product) => <ProductCard key={product.id} product={product} />)}</RevealGroup>}
    </div>
  </section>;
}

function ReviewSection({ title, description, reviews }: { title: string; description?: string | null; reviews: ApprovedReviewSummary[] }) {
  if (!reviews.length) return null;
  return <section className="home-product-section reviews-section"><div className="content-container"><Reveal as="section" className="section-heading"><div><p className="eyebrow">كلمات طيبة</p><h2>{title}</h2>{description ? <p>{description}</p> : null}</div></Reveal><RevealGroup className="reviews-grid">{reviews.slice(0, 6).map((review) => <article className="review-card" key={review.id}><div className="review-card__stars" aria-label={`التقييم ${review.rating} من 5`}>{"★".repeat(Math.max(0, Math.min(5, review.rating)))}<span>{"★".repeat(5 - Math.max(0, Math.min(5, review.rating)))}</span></div>{review.comment ? <blockquote>“{review.comment}”</blockquote> : <p className="review-card__empty">تجربة لطيفة مع {review.productName}</p>}<div className="review-card__by"><strong>{review.customerName}</strong><small>{review.productName}</small></div></article>)}</RevealGroup></div></section>;
}
