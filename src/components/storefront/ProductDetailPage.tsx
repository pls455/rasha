"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Reveal } from "@/components/design";
import type { Product, ProductVariant } from "@/lib/contracts/storefront";
import { useCart } from "@/lib/cart-context";
import { getProduct } from "@/lib/storefront-api";
import { formatIls } from "@/lib/money";
import { ReviewForm } from "@/components/storefront/ReviewForm";

export function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getProduct(params.slug).then((result) => {
      if (!active) return;
      setProduct(result);
      setSelectedVariantId(result.variants.find((variant) => variant.isActive && variant.stockQuantity > 0)?.id || result.variants.find((variant) => variant.isActive)?.id || "");
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "لم نجد هذا العطر.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.slug]);

  const images = useMemo(() => [...(product?.images || [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.displayOrder - b.displayOrder), [product]);
  const variant: ProductVariant | undefined = product?.variants.find((entry) => entry.id === selectedVariantId);
  const isAvailable = Boolean(variant?.isActive && variant.stockQuantity > 0);

  if (loading) return <div className="content-container loading-line" role="status">نجهّز تفاصيل العطر...</div>;
  if (error || !product) return <section className="content-container empty-state product-not-found"><span className="empty-state__mark">✦</span><h1>العطر غير متاح</h1><p>{error || "لا تتوفر تفاصيل لهذا الرابط حالياً."}</p><Link className="button button--outline" href="/original">تصفّح العطور</Link></section>;

  const handleAdd = () => {
    if (!variant || !isAvailable) return;
    const result = add(product, variant, quantity);
    setNotice(result.message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  return <div className="content-container product-detail-page">
    <nav className="breadcrumbs" aria-label="مسار التنقل"><Link href="/">الرئيسية</Link><span aria-hidden="true">/</span><Link href={product.productType === "original" ? "/original" : "/blended"}>{product.productType === "original" ? "العطور الأصلية" : "عطور التركيب"}</Link><span aria-hidden="true">/</span><span>{product.name}</span></nav>
    <div className="product-detail">
      <Reveal className="product-detail__gallery">
        <div className="product-detail__main-image">{images[selectedImage] ? <Image src={images[selectedImage].imageUrl} alt={images[selectedImage].altText || product.name} width={1000} height={1000} priority sizes="(max-width: 760px) 100vw, 50vw" unoptimized /> : <span className="image-placeholder">رَشّة</span>}</div>
        {images.length > 1 ? <div className="product-detail__thumbs">{images.map((image, index) => <button key={image.id} className={selectedImage === index ? "thumb is-selected" : "thumb"} type="button" aria-label={`عرض الصورة ${index + 1}`} onClick={() => setSelectedImage(index)}><Image src={image.imageUrl} alt="" width={100} height={100} loading="lazy" unoptimized /></button>)}</div> : null}
      </Reveal>
      <Reveal className="product-detail__info" delay={0.08}>
        <p className="eyebrow">{product.brand?.name || (product.productType === "original" ? "عطر أصلي" : "عطر تركيب")}</p>
        <h1>{product.name}</h1>
        {product.description ? <p className="product-description">{product.description}</p> : null}
        <div className="product-price">{variant ? formatIls(variant.price) : "السعر غير متاح"}{variant?.compareAtPrice ? <del>{formatIls(variant.compareAtPrice)}</del> : null}</div>
        {product.scentFamily ? <p className="detail-meta"><span>العائلة العطرية</span><strong>{product.scentFamily}</strong></p> : null}
        {product.originCountry ? <p className="detail-meta"><span>بلد المنشأ</span><strong>{product.originCountry}</strong></p> : null}
        {product.notes.length ? <div className="notes-block"><span className="detail-label">النوتات</span><div className="note-chips">{product.notes.map((note) => <span key={note}>{note}</span>)}</div></div> : null}
        <div className="detail-field"><span className="detail-label">اختاري الحجم</span><div className="variant-options">{product.variants.filter((entry) => entry.isActive).map((entry) => <button key={entry.id} type="button" className={selectedVariantId === entry.id ? "variant-option is-selected" : "variant-option"} onClick={() => { setSelectedVariantId(entry.id); setQuantity(1); }}><span>{entry.sizeLabel}</span><small>{entry.stockQuantity > 0 ? formatIls(entry.price) : "غير متوفر"}</small></button>)}</div></div>
        {variant ? <p className="stock-detail">{isAvailable ? `متوفر من هذا الحجم: ${variant.stockQuantity}` : "هذا الحجم غير متوفر حالياً"}</p> : null}
        <div className="product-purchase-row"><div className="quantity-picker" aria-label="الكمية"><button type="button" aria-label="زيادة الكمية" disabled={!isAvailable || quantity >= (variant?.stockQuantity || 0)} onClick={() => setQuantity((current) => current + 1)}>+</button><span>{quantity}</span><button type="button" aria-label="تقليل الكمية" disabled={quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button></div><button className="button button--gold add-to-cart" type="button" disabled={!isAvailable} onClick={handleAdd}>أضف إلى السلة <span aria-hidden="true">←</span></button></div>
        {notice ? <p className="toast-notice" role="status">{notice}</p> : null}
        <p className="delivery-note">التوصيل داخل قطاع غزة. تكلفة التوصيل تُحدد عبر واتساب ولا تُضاف هنا.</p>
      </Reveal>
    </div>
    <ReviewForm productId={product.id} productName={product.name} />
  </div>;
}
