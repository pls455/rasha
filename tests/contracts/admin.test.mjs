import test from "node:test";
import assert from "node:assert/strict";
import { missingOrderMessageTemplateTokens } from "../../src/lib/contracts/admin.ts";

test("accepts an order template with every required placeholder", () => {
  const template = "{storeName} {orderNumber} {items} {subtotal} {deliveryNote}";
  assert.deepEqual(missingOrderMessageTemplateTokens(template), []);
});

test("reports every missing required order placeholder", () => {
  const template = "{storeName} {items}";
  assert.deepEqual(missingOrderMessageTemplateTokens(template), [
    "{orderNumber}",
    "{subtotal}",
    "{deliveryNote}",
  ]);
});
