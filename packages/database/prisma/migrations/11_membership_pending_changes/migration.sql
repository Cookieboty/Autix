-- AlterTable
ALTER TABLE "user_memberships"
    ADD COLUMN IF NOT EXISTS "pendingPlanId" TEXT,
    ADD COLUMN IF NOT EXISTS "pendingOrderId" TEXT,
    ADD COLUMN IF NOT EXISTS "pendingLevelId" TEXT,
    ADD COLUMN IF NOT EXISTS "pendingBillingCycle" "BillingCycle",
    ADD COLUMN IF NOT EXISTS "pendingAutoRenew" BOOLEAN,
    ADD COLUMN IF NOT EXISTS "pendingChangeEffectiveAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "pendingChangeRequestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_memberships_pendingChangeEffectiveAt_idx"
    ON "user_memberships"("pendingChangeEffectiveAt");
