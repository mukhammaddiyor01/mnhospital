# Service discounts and booking promo codes

Admin service discounts use `setServiceDiscountByAdmin` and `serviceDiscountPercent` (0–100). The original service price stays intact; 0 removes its discount. Doctor inputs do not expose this administrative field. Public service queries return the percentage for display; the server determines booking and payment prices.

Promo codes follow the existing Booking module resolver → service → Mongoose pattern. Only ADMIN can list, create, update or archive them. Codes are normalized to uppercase and unique, including archived codes. A code supports percentage or fixed discount, optional start/expiry, minimum eligible amount after the service discount, optional service IDs, and active status. Its creation currency is retained on edits. Archiving blocks new use and preserves historical references.

Only PATIENT can apply/remove a code on their own unpaid PENDING order with `pricingVersion: 1`, before payment begins. One code is attached per order. There is no usage quota or redemption counter. Existing orders without pricing snapshots keep their original payment flow and do not accept promo codes.

New cart items and direct appointment bookings snapshot base price, service discount and final line price. Promo codes apply after the service discount. Replacing or removing a code recalculates from the original snapshots, avoiding compounded discounts. Fixed discounts are capped at the eligible payable amount. KRW uses whole units; other supported clinic currencies use two decimal places. Allocation across lines uses integer units so payment line totals equal the order total.

The first payment intent locks the order's pricing atomically. Promo changes and payment creation therefore cannot produce a different charged amount. A code must still be active when payment first starts; later admin changes do not alter an already locked payment. Cash remains pending until the existing receptionist confirmation flow. Online simulation and Eximbay provider handling retain the existing implementation. Orders containing a zero-price line use cash confirmation and create no online payment intent.

Verification: 398 unit tests, 22 isolated MongoDB/API integration cases, frontend build, 411 GraphQL documents and 166 workspace API fields. Browser verification covers admin discount creation, promo creation and patient checkout apply/remove/reapply. Test fixtures use an isolated database; no real payment is taken.

## Homepage offers

Admins explicitly opt codes into homepage publication using `showOnHomepage` (default false; legacy codes stay hidden). `getPublicPromoOffers` projects only public offer fields, returns at most three recently updated offers and filters inactive, archived, future, expired and other-currency codes. This public display does not apply discounts or change checkout rules. The homepage shows the amount, copyable code, minimum eligible amount, eligible service scope and expiry. Codes for selected services link to an eligible service. Admins can disable publication without deactivating private code use.
