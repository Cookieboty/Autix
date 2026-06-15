-- AlterTable
ALTER TABLE "points_packages"
    ADD COLUMN IF NOT EXISTS "code" TEXT,
    ADD COLUMN IF NOT EXISTS "description" TEXT,
    ADD COLUMN IF NOT EXISTS "validityDays" INTEGER NOT NULL DEFAULT 180,
    ADD COLUMN IF NOT EXISTS "usageScope" JSONB,
    ADD COLUMN IF NOT EXISTS "showCommercialLicense" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "points_packages_code_key" ON "points_packages"("code");
