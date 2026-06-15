-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderBusinessType') THEN
        CREATE TYPE "OrderBusinessType" AS ENUM (
            'subscription_order',
            'points_order',
            'renewal_order',
            'upgrade_order',
            'refund_order'
        );
    END IF;
END $$;

-- AlterTable
ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "businessType" "OrderBusinessType",
    ADD COLUMN IF NOT EXISTS "fulfilledAt" TIMESTAMP(3);

UPDATE "orders"
SET "businessType" = CASE
    WHEN "orderType" = 'POINTS_PACKAGE' THEN 'points_order'::"OrderBusinessType"
    ELSE 'subscription_order'::"OrderBusinessType"
END
WHERE "businessType" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "orders_businessType_idx" ON "orders"("businessType");
CREATE INDEX IF NOT EXISTS "orders_fulfilledAt_idx" ON "orders"("fulfilledAt");
