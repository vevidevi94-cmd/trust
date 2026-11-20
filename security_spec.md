# Firestore Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants
1. **Default Deny**: All paths outside `/orders/{orderId}`, `/order_receipts/{orderId}`, `/app_config/{configId}`, and `/admins/{adminUid}` are strictly denied for both read and write.
2. **Admin Isolation**: Only a verified Firebase Auth admin (`request.auth.token.email == 'vevidevi94@gmail.com' && request.auth.token.email_verified == true` OR a verified user whose UID exists in `/admins/{uid}`) may `list` `/orders`, `update` order status/messages, `delete` orders, `get`/`delete` `/order_receipts`, or mutate `/app_config`.
3. **Order Creation Integrity**: A newly created order MUST have `status == 'pending'`, `adminMessage == ''`, `hiddenFromAdmin == false`, `recentAlerts.size() == 0`, valid `order_id == orderId` matching `^ORD[0-9]+_[a-zA-Z0-9]+$`, valid `uid` matching `^TRUST-[0-9]{4}$`, positive `price`/`amount`, and `serverCreatedAt == request.time && serverUpdatedAt == request.time`.
4. **Payment Receipt Isolation (PII/Proof Split)**: Payment screenshots are stored exclusively in `/order_receipts/{orderId}` (never embedded inside `/orders/{orderId}`), require `exists(/databases/$(database)/documents/orders/$(orderId))` on create, forbid updates, forbid list queries, and restrict `get` and `delete` strictly to `isAdmin()`.
5. **Immutability & Anti-Shadow Fields**: `id`, `order_id`, `uid`, `service`, `pack`, `price`, `amount`, `link`, `date`, `createdAt`, `serverCreatedAt` are immutable after order creation. Every `create` enforces `hasAll` + `hasOnly`, and every `update` enforces `affectedKeys().hasOnly(...)` + full `isValidOrder(incoming())`.
6. **Bounded Arrays & String Sizes**: Every string has an explicit `.size()` bound, and `recentAlerts` is strictly capped at `<= 25` elements with element type validation.

## 2. The "Dirty Dozen" Attack Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Order List Scrape**: `LIST /orders` by non-admin -> DENIED (`allow list: if isAdmin()`).
2. **Unverified Admin Email Spoof**: Request with `email == 'vevidevi94@gmail.com'` and `email_verified == false` -> DENIED (`email_verified == true` required).
3. **Self-Assigned Admin Escalation**: Non-admin `CREATE /admins/{uid}` with `{ role: 'admin' }` -> DENIED (only existing verified admin can write `/admins`).
4. **Status Forgery on Create**: Customer `CREATE /orders/ORD123_abc` with `status: 'successful'` -> DENIED (create mandates `status == 'pending'`).
5. **Shadow Field Injection on Create**: Customer `CREATE /orders/ORD123_abc` with extra field `isPaid: true` -> DENIED (`hasOnly` rejects unknown keys).
6. **Customer Status Tampering on Update**: Non-admin `UPDATE /orders/ORD123_abc` setting `status: 'successful'` -> DENIED (`allow update: if isAdmin()`).
7. **Payment Receipt Theft**: Non-admin `GET /order_receipts/ORD123_abc` -> DENIED (`allow get: if isAdmin()`).
8. **Orphaned Receipt Flooding**: `CREATE /order_receipts/ORD999_fake` when `/orders/ORD999_fake` does not exist -> DENIED (`exists(...)` parent check).
9. **ID Poisoning Attack**: `CREATE /orders/../../../evil` or 200-char ID -> DENIED (`isValidId` + `order_id` regex).
10. **Denial-of-Wallet Oversized String**: `CREATE /orders/ORD123_abc` with 20KB `link` -> DENIED (`link.size() <= 500`).
11. **Timestamp Forgery**: `CREATE /orders/ORD123_abc` with backdated `serverCreatedAt` != `request.time` -> DENIED.
12. **Catalog / Poster Defacement**: Non-admin `UPDATE /app_config/catalog` setting all prices to `0` -> DENIED (`isAdmin()` required).
