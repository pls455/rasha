"use client";

import { useState, type FormEvent } from "react";
import type { CreateReviewRequest } from "@/lib/contracts/storefront";
import { createReview, StorefrontApiError } from "@/lib/storefront-api";

export function ReviewForm({ productId, productName }: { productId: string; productName: string }) {
  const [customerName, setCustomerName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const payload: CreateReviewRequest = { productId, customerName: customerName.trim(), rating, ...(comment.trim() ? { comment: comment.trim() } : {}) };
      const response = await createReview(payload);
      setNotice(response.item.status === "pending" ? "وصل تقييمك، وهو قيد المراجعة قبل ما يظهر للزوار. شكراً لمشاركتك." : "وصل تقييمك. شكراً لمشاركتك."); setCustomerName(""); setComment(""); setRating(5);
    } catch (cause) { setError(cause instanceof StorefrontApiError && cause.status === 429 ? "وصلت الحد المسموح من التقييمات مؤقتاً. جرّب بعد قليل." : cause instanceof Error ? cause.message : "تعذّر إرسال التقييم."); }
    finally { setBusy(false); }
  };
  return <section className="review-submit-section"><div><p className="eyebrow">رأيك يهمنا</p><h2>قيّم {productName}</h2><p className="admin-inline-note">التقييم يمر بمراجعة المتجر قبل ظهوره.</p></div>{notice ? <p className="review-submit-success" role="status">{notice}</p> : <form className="review-submit-form" onSubmit={submit}><label className="detail-field">اسمك<input required maxLength={100} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label><fieldset className="review-rating-field"><legend>تقييمك</legend>{[1,2,3,4,5].map((value) => <label key={value} aria-label={`${value} من 5`}><input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} /><span aria-hidden="true">★</span></label>)}</fieldset><label className="detail-field">تعليق (اختياري)<textarea maxLength={1000} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} /></label>{error ? <p className="toast-notice" role="alert">{error}</p> : null}<button className="button button--gold" disabled={busy}>{busy ? "جارٍ الإرسال..." : "إرسال التقييم"}</button></form>}</section>;
}
