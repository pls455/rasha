# Storefront API contracts

Import shared storefront types from `@/lib/contracts/storefront`.

- JSON fields use camelCase.
- Prices and totals are decimal strings, not JavaScript floating-point numbers.
- Product lists use `items` and `pagination: { page, pageSize, total, hasMore }`.
- `POST /api/orders` accepts `items: [{ variantId, quantity }]`, `idempotencyKey`, and optional customer contact/notes; it never accepts client prices or totals.
- Order creation returns `orderId`, `orderNumber`, status `whatsapp_initiated`, `subtotal`, `currency: "ILS"`, `deliveryCost: null`, snapshot items, and `whatsappUrl`.
- Inventory is not reserved or deducted when a WhatsApp order is created. Authorized status changes must apply stock updates atomically and idempotently.

The client-side validator is for UX only. Server routes must validate inputs again, load current catalog data, calculate totals, and enforce permissions.
