-- Reconcile user_memberships drift on environments that were baselined from an
-- older `db push` schema (00_init marked applied, but billing columns missing).
-- Idempotent: safe no-op where the columns/indexes already exist (e.g. fresh DBs
-- created from the current 00_init).

-- Enum may already exist; guard so this migration is safe everywhere.
DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "user_memberships"
  ADD COLUMN IF NOT EXISTS "planId"                   TEXT,
  ADD COLUMN IF NOT EXISTS "autoRenew"                BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cancelledAt"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stripeCustomerId"         TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId"     TEXT,
  ADD COLUMN IF NOT EXISTS "pendingPlanId"            TEXT,
  ADD COLUMN IF NOT EXISTS "pendingOrderId"           TEXT,
  ADD COLUMN IF NOT EXISTS "pendingLevelId"           TEXT,
  ADD COLUMN IF NOT EXISTS "pendingBillingCycle"      "BillingCycle",
  ADD COLUMN IF NOT EXISTS "pendingAutoRenew"         BOOLEAN,
  ADD COLUMN IF NOT EXISTS "pendingChangeEffectiveAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pendingChangeRequestedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "user_memberships_pendingChangeEffectiveAt_idx"
  ON "user_memberships"("pendingChangeEffectiveAt");
CREATE INDEX IF NOT EXISTS "user_memberships_stripeSubscriptionId_idx"
  ON "user_memberships"("stripeSubscriptionId");
