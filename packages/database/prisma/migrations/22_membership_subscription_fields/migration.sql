ALTER TABLE "user_memberships"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

CREATE INDEX IF NOT EXISTS "user_memberships_stripeSubscriptionId_idx"
  ON "user_memberships"("stripeSubscriptionId");
