-- AlterTable
ALTER TABLE "orders"
    ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT,
    ADD COLUMN IF NOT EXISTS "externalPaymentId" TEXT,
    ADD COLUMN IF NOT EXISTS "paymentEventId" TEXT,
    ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS "currency" TEXT,
    ADD COLUMN IF NOT EXISTS "paymentMetadata" JSONB,
    ADD COLUMN IF NOT EXISTS "refundProvider" TEXT,
    ADD COLUMN IF NOT EXISTS "externalRefundId" TEXT,
    ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS "refundReason" TEXT,
    ADD COLUMN IF NOT EXISTS "refundMetadata" JSONB,
    ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "orderNo" TEXT,
    "externalPaymentId" TEXT,
    "amount" DECIMAL(10, 2),
    "currency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_provider_eventId_key"
    ON "payment_events"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "payment_events_orderId_idx" ON "payment_events"("orderId");
CREATE INDEX IF NOT EXISTS "payment_events_userId_idx" ON "payment_events"("userId");
CREATE INDEX IF NOT EXISTS "payment_events_orderNo_idx" ON "payment_events"("orderNo");
CREATE INDEX IF NOT EXISTS "payment_events_status_createdAt_idx" ON "payment_events"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_paymentProvider_externalPaymentId_idx"
    ON "orders"("paymentProvider", "externalPaymentId");
CREATE INDEX IF NOT EXISTS "orders_paymentEventId_idx" ON "orders"("paymentEventId");
CREATE INDEX IF NOT EXISTS "orders_refundedAt_idx" ON "orders"("refundedAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_events_orderId_fkey'
    ) THEN
        ALTER TABLE "payment_events"
            ADD CONSTRAINT "payment_events_orderId_fkey"
            FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_events_userId_fkey'
    ) THEN
        ALTER TABLE "payment_events"
            ADD CONSTRAINT "payment_events_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
