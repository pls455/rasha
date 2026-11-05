import Image from "next/image";
import Link from "next/link";
import { RevealItem } from "@/components/design";
import type { Product } from "@/lib/contracts/storefront";
import { formatIls, toMinorUnits } from "@/lib/money";

export function ProductCard({ product }: { product: Product }) {
  const image = product.images.find((entry) => entry.isPrimary) || product.images[0];
  const activeVariants = product.variants.filter((variant) => variant.isActive);
  const lowest = activeVariants.length ? activeVariants.reduce((best, item) => toMinorUnits(item.price) < toMinorUnits(best.price) ? item : best) : null;
  const hasDiscount = Boolean(lowest?.compareAtPrice && toMinorUnits(lowest.compareAtPrice) > toMinorUnits(lowest.price));
  const available = activeVariants.some((variant) => variant.stockQuantity > 0);
  const typeLabel = product.productType === "original" ? "عطر أصلي" : "عطر تركيب";

  return <RevealItem className="product-card-wrap">
    <article className="product-card">
      <Link className="product-card__image" href={`/product/${encodeURIComponent(product.slug)}`} aria-label={`عرض ${product.name}`}>
        {image ? <Image src={image.imageUrl} alt={image.altText || product.name} width={680} height={760} loading="lazy" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 30vw, 23vw" unoptimized /> : <span className="image-placeholder" aria-label="الصورة غير متوفرة">رَشّة</span>}
        {product.isFeatured ? <span className="product-badge">مختار بعناية</span> : null}
      </Link>
      <div className="product-card__body">
        <p className="product-card__eyebrow">{product.brand?.name || typeLabel}</p>
        <h3><Link href={`/product/${encodeURIComponent(product.slug)}`}>{product.name}</Link></h3>
        <div className="product-card__meta">
          {lowest ? <p>{activeVariants.length > 1 ? "يبدأ من " : ""}<strong>{formatIls(lowest.price)}</strong>{hasDiscount ? <del className="product-card__compare-price">{formatIls(lowest.compareAtPrice!)}</del> : null}</p> : <p className="muted">السعر غير متاح</p>}
          <span className={available ? "stock-state stock-state--available" : "stock-state"}>{available ? "متوفر" : "غير متوفر"}</span>
        </div>
        <Link className="text-link" href={`/product/${encodeURIComponent(product.slug)}`}>عرض العطر <span aria-hidden="true">←</span></Link>
      </div>
    </article>
  </RevealItem>;
}
