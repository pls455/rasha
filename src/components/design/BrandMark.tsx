import type { AnchorHTMLAttributes } from "react";

type BrandMarkProps = {
  tagline?: string;
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children">;

export function BrandMark({ tagline = "لكل رائحة حكاية", className, ...props }: BrandMarkProps) {
  return (
    <a className={["rasha-brand", className].filter(Boolean).join(" ")} href="/" {...props}>
      <span className="rasha-brand__mark" aria-hidden="true">ر</span>
      <span className="rasha-brand__copy">
        <span className="rasha-brand__name">RASHA</span>
        <span className="rasha-brand__tagline" lang="ar" dir="rtl">{tagline}</span>
      </span>
    </a>
  );
}

export function GoldRule({ className }: { className?: string }) {
  return <span className={["rasha-gold-rule", className].filter(Boolean).join(" ")} aria-hidden="true" />;
}
