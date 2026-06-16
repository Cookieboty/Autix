CREATE TABLE IF NOT EXISTS "material_assets" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" VARCHAR(24) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "mimeType" VARCHAR(120),
  "size" INTEGER,
  "storageKey" VARCHAR(500),
  "sourceType" VARCHAR(40) NOT NULL,
  "sourceId" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMPTZ(6),
  CONSTRAINT "material_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "material_assets_userId_createdAt_idx" ON "material_assets"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "material_assets_userId_type_idx" ON "material_assets"("userId", "type");
CREATE INDEX IF NOT EXISTS "material_assets_userId_deletedAt_idx" ON "material_assets"("userId", "deletedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'material_assets_userId_fkey'
  ) THEN
    ALTER TABLE "material_assets"
      ADD CONSTRAINT "material_assets_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
