import test from "node:test";
import assert from "node:assert/strict";
import { validateCreateOrderRequest, validateCreateReviewRequest } from "../../src/lib/contracts/storefront.ts";

test("accepts a valid order request without client-supplied prices", () => {
  const result = validateCreateOrderRequest({
    items: [{ variantId: "variant-1", quantity: 2 }],
    idempotencyKey: "request-1",
    customerName: "كرم",
    customerPhone: "+972590000000",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.items, [{ variantId: "variant-1", quantity: 2 }]);
  assert.equal(result.value.customerName, "كرم");
  assert.equal("subtotal" in result.value, false);
  assert.equal("unitPrice" in result.value.items[0], false);
});

test("trims request identifiers and optional text", () => {
  const result = validateCreateOrderRequest({
    items: [{ variantId: " variant-1 ", quantity: 1 }],
    idempotencyKey: " request-2 ",
    notes: "  بدون هدية  ",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.items[0].variantId, "variant-1");
  assert.equal(result.value.idempotencyKey, "request-2");
  assert.equal(result.value.notes, "بدون هدية");
});

test("rejects an empty cart", () => {
  const result = validateCreateOrderRequest({ items: [], idempotencyKey: "request-3" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.issues.some(({ field }) => field === "items"));
});

test("rejects zero, fractional, and string quantities", () => {
  for (const quantity of [0, 1.5, "2"]) {
    const result = validateCreateOrderRequest({
      items: [{ variantId: "variant-1", quantity }],
      idempotencyKey: "request-4",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.issues.some(({ field }) => field === "items.0.quantity"));
  }
});

test("rejects missing idempotency key, invalid optional fields, and oversized notes", () => {
  const result = validateCreateOrderRequest({
    items: [{ variantId: "variant-1", quantity: 1 }],
    customerPhone: 123,
    notes: "x".repeat(2001),
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some(({ field }) => field === "idempotencyKey"));
    assert.ok(result.issues.some(({ field }) => field === "customerPhone"));
    assert.ok(result.issues.some(({ field }) => field === "notes"));
  }
});

test("rejects non-object payloads", () => {
  const result = validateCreateOrderRequest(null);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.issues[0].field, "body");
});

test("accepts a review and trims plain-text fields", () => {
  const result = validateCreateReviewRequest({
    productId: "product-1",
    customerName: "  زبون  ",
    rating: 5,
    comment: "  رائحة جميلة  ",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value, {
    productId: "product-1",
    customerName: "زبون",
    rating: 5,
    comment: "رائحة جميلة",
  });
});

test("rejects an invalid review rating and HTML comment", () => {
  const result = validateCreateReviewRequest({
    productId: "product-1",
    customerName: "زبون",
    rating: 6,
    comment: "<script>alert(1)</script>",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.issues.some(({ field }) => field === "rating"));
    assert.ok(result.issues.some(({ field }) => field === "comment"));
  }
});
