-- Convert RMB-denominated payment amounts to USD at 1 USD = 7 RMB.
-- This migration only touches monetary columns; membership/package points are unchanged.

UPDATE "membership_levels"
SET "monthlyPrice" = ROUND("monthlyPrice" / 7, 2);

UPDATE "membership_plans"
SET
  "originalPrice" = ROUND("originalPrice" / 7, 2),
  "price" = ROUND("price" / 7, 2),
  "firstTimePrice" = CASE
    WHEN "firstTimePrice" IS NULL THEN NULL
    ELSE ROUND("firstTimePrice" / 7, 2)
  END;

UPDATE "points_packages"
SET "price" = ROUND("price" / 7, 2);

UPDATE "orders"
SET
  "originalPrice" = ROUND("originalPrice" / 7, 2),
  "amount" = ROUND("amount" / 7, 2),
  "paidAmount" = CASE
    WHEN "paidAmount" IS NULL THEN NULL
    ELSE ROUND("paidAmount" / 7, 2)
  END,
  "refundAmount" = CASE
    WHEN "refundAmount" IS NULL THEN NULL
    ELSE ROUND("refundAmount" / 7, 2)
  END,
  "currency" = 'USD'
WHERE "currency" IS NULL OR UPPER("currency") = 'CNY';

UPDATE "payment_events"
SET
  "amount" = CASE
    WHEN "amount" IS NULL THEN NULL
    ELSE ROUND("amount" / 7, 2)
  END,
  "currency" = 'USD'
WHERE "currency" IS NULL OR UPPER("currency") = 'CNY';

UPDATE "system_settings"
SET "value" = 'USD', "updatedAt" = now()
WHERE "key" = 'payments.stripeCurrency'
  AND UPPER("value") = 'CNY';
