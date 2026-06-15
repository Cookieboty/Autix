-- AlterTable
ALTER TABLE "user_memberships"
    ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
