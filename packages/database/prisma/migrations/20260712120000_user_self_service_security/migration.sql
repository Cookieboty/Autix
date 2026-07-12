-- User account self-service schema completion.
-- This migration intentionally covers every schema addition introduced by the
-- feature so a fresh database built from migration history matches schema.prisma.

ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DELETED';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "nickname" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "avatarStorageKey" TEXT;

DO $$ BEGIN
  CREATE TYPE "SocialLoginFlow" AS ENUM ('LOGIN', 'LINK', 'REAUTH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailOtpPurpose" AS ENUM (
    'STEP_UP_CHANGE_PASSWORD',
    'STEP_UP_SET_PASSWORD',
    'STEP_UP_CHANGE_EMAIL',
    'STEP_UP_DELETE_ACCOUNT',
    'STEP_UP_UNLINK_PROVIDER',
    'EMAIL_CHANGE_CONFIRM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PendingUploadPurpose" AS ENUM ('AVATAR', 'GENERIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PendingUploadStatus" AS ENUM ('PENDING', 'CONSUMED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "social_login_states"
  ADD COLUMN IF NOT EXISTS "flow" "SocialLoginFlow" NOT NULL DEFAULT 'LOGIN',
  ADD COLUMN IF NOT EXISTS "purpose" "EmailOtpPurpose",
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

CREATE TABLE IF NOT EXISTS "email_otps" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "emailHash" VARCHAR(128) NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" "EmailOtpPurpose" NOT NULL,
  "sessionId" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "email_otps"
  ADD COLUMN IF NOT EXISTS "sessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "invalidatedAt" TIMESTAMP(3);
UPDATE "email_otps"
SET "sessionId" = 'migration-invalid', "invalidatedAt" = COALESCE("invalidatedAt", CURRENT_TIMESTAMP)
WHERE "sessionId" IS NULL;
ALTER TABLE "email_otps" ALTER COLUMN "sessionId" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "step_up_proofs" (
  "jti" VARCHAR(64) NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" VARCHAR(128) NOT NULL,
  "purpose" "EmailOtpPurpose" NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "step_up_proofs_pkey" PRIMARY KEY ("jti"),
  CONSTRAINT "step_up_proofs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "pending_uploads" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "storageBucket" TEXT,
  "contentType" VARCHAR(80),
  "sizeBytes" INTEGER,
  "purpose" "PendingUploadPurpose" NOT NULL DEFAULT 'AVATAR',
  "status" "PendingUploadStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pending_uploads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pending_uploads_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "dimension" VARCHAR(200) NOT NULL,
  "bucketStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("dimension", "bucketStart")
);

CREATE INDEX IF NOT EXISTS "email_otps_userId_sessionId_purpose_idx" ON "email_otps"("userId", "sessionId", "purpose");
CREATE INDEX IF NOT EXISTS "email_otps_emailHash_purpose_idx" ON "email_otps"("emailHash", "purpose");
CREATE INDEX IF NOT EXISTS "email_otps_expiresAt_idx" ON "email_otps"("expiresAt");
CREATE INDEX IF NOT EXISTS "step_up_proofs_userId_sessionId_purpose_idx" ON "step_up_proofs"("userId", "sessionId", "purpose");
CREATE INDEX IF NOT EXISTS "step_up_proofs_expiresAt_idx" ON "step_up_proofs"("expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "pending_uploads_storageKey_key" ON "pending_uploads"("storageKey");
CREATE INDEX IF NOT EXISTS "pending_uploads_ownerUserId_status_idx" ON "pending_uploads"("ownerUserId", "status");
CREATE INDEX IF NOT EXISTS "pending_uploads_expiresAt_status_idx" ON "pending_uploads"("expiresAt", "status");
CREATE INDEX IF NOT EXISTS "rate_limit_counters_bucketStart_idx" ON "rate_limit_counters"("bucketStart");
