-- CreateEnum
ALTER TYPE "PointsSource" ADD VALUE IF NOT EXISTS 'CAMPAIGN';
ALTER TYPE "PointsSource" ADD VALUE IF NOT EXISTS 'EXPIRATION';

-- CreateEnum
CREATE TYPE "PointGrantType" AS ENUM ('SUBSCRIPTION', 'PURCHASED', 'GIFT', 'COMPENSATION');

-- CreateEnum
CREATE TYPE "PointLedgerEventType" AS ENUM (
    'subscription_grant',
    'points_purchase',
    'generation_freeze',
    'generation_cost',
    'generation_refund',
    'admin_adjustment',
    'campaign_bonus',
    'expiration',
    'migration_legacy_balance'
);

-- CreateEnum
CREATE TYPE "PointHoldStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'CONFIRMED',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'CANCELLED',
    'BLOCKED',
    'EXPIRED'
);

-- CreateEnum
CREATE TYPE "PricingBaseUnit" AS ENUM ('image', 'second', 'task', 'message', 'token', 'tool_call');

-- CreateEnum
CREATE TYPE "PricingModelTier" AS ENUM ('fast', 'standard', 'pro_reasoning');

-- AlterTable
ALTER TABLE "user_points"
    ADD COLUMN "availableBalance" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "frozenBalance" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "totalBalance" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "subscriptionBalance" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "purchasedBalance" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "giftBalance" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "compensationBalance" INTEGER NOT NULL DEFAULT 0;

UPDATE "user_points"
SET
    "availableBalance" = "balance",
    "totalBalance" = "balance",
    "compensationBalance" = "balance"
WHERE "availableBalance" = 0
  AND "frozenBalance" = 0
  AND "totalBalance" = 0
  AND "balance" <> 0;

-- CreateTable
CREATE TABLE "point_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantType" "PointGrantType" NOT NULL,
    "sourceEvent" "PointLedgerEventType" NOT NULL,
    "sourceId" TEXT,
    "totalAmount" INTEGER NOT NULL,
    "availableAmount" INTEGER NOT NULL DEFAULT 0,
    "frozenAmount" INTEGER NOT NULL DEFAULT 0,
    "consumedAmount" INTEGER NOT NULL DEFAULT 0,
    "expiredAmount" INTEGER NOT NULL DEFAULT 0,
    "refundedAmount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "usageScope" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "point_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_holds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "taskId" TEXT,
    "estimatedAmount" INTEGER NOT NULL,
    "confirmedAmount" INTEGER,
    "status" "PointHoldStatus" NOT NULL DEFAULT 'PENDING',
    "pricingSnapshot" JSONB,
    "refundPolicySnapshot" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "point_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_hold_items" (
    "id" TEXT NOT NULL,
    "holdId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "grantType" "PointGrantType" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_hold_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_pricing_rules" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelProvider" TEXT,
    "modelName" TEXT,
    "quality" TEXT,
    "resolution" TEXT,
    "modelTier" "PricingModelTier",
    "baseUnit" "PricingBaseUnit" NOT NULL DEFAULT 'task',
    "baseCost" INTEGER NOT NULL DEFAULT 0,
    "inputTokenCostPerK" DECIMAL(10,2),
    "outputTokenCostPerK" DECIMAL(10,2),
    "contextTokenCostPerK" DECIMAL(10,2),
    "reasoningMultiplier" DECIMAL(6,2) NOT NULL DEFAULT 1.0,
    "toolCallCost" INTEGER,
    "batchUnitCost" INTEGER,
    "minDurationSeconds" INTEGER,
    "maxDurationSeconds" INTEGER,
    "referenceImageFixedCost" INTEGER,
    "referenceImageMultiplier" DECIMAL(6,2),
    "videoInputMultiplier" DECIMAL(6,2),
    "audioInputMultiplier" DECIMAL(6,2),
    "priorityMultiplier" DECIMAL(6,2),
    "fixedExtraCost" INTEGER NOT NULL DEFAULT 0,
    "allowedMembershipLevels" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "disallowedGrantTypes" "PointGrantType"[] DEFAULT ARRAY[]::"PointGrantType"[],
    "refundPolicy" JSONB,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "point_grants_userId_expiresAt_idx" ON "point_grants"("userId", "expiresAt");
CREATE INDEX "point_grants_userId_grantType_idx" ON "point_grants"("userId", "grantType");
CREATE INDEX "point_grants_sourceEvent_sourceId_idx" ON "point_grants"("sourceEvent", "sourceId");
CREATE INDEX "point_holds_userId_status_idx" ON "point_holds"("userId", "status");
CREATE INDEX "point_holds_taskType_taskId_idx" ON "point_holds"("taskType", "taskId");
CREATE INDEX "point_hold_items_holdId_idx" ON "point_hold_items"("holdId");
CREATE INDEX "point_hold_items_grantId_idx" ON "point_hold_items"("grantId");
CREATE UNIQUE INDEX "generation_pricing_rules_taskType_name_key" ON "generation_pricing_rules"("taskType", "name");
CREATE INDEX "generation_pricing_rules_taskType_isActive_idx" ON "generation_pricing_rules"("taskType", "isActive");
CREATE INDEX "generation_pricing_rules_modelProvider_modelName_idx" ON "generation_pricing_rules"("modelProvider", "modelName");
CREATE INDEX "generation_pricing_rules_modelTier_idx" ON "generation_pricing_rules"("modelTier");
CREATE INDEX "generation_pricing_rules_effectiveFrom_effectiveTo_idx" ON "generation_pricing_rules"("effectiveFrom", "effectiveTo");

-- AddForeignKey
ALTER TABLE "point_grants" ADD CONSTRAINT "point_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "point_holds" ADD CONSTRAINT "point_holds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "point_hold_items" ADD CONSTRAINT "point_hold_items_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "point_holds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "point_hold_items" ADD CONSTRAINT "point_hold_items_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "point_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
