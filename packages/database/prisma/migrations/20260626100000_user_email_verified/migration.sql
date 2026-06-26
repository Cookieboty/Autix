-- AlterTable: add emailVerified and pendingEmail to users
ALTER TABLE "users" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "pendingEmail" TEXT;

-- Backfill: mark placeholder-email OAuth users as unverified
UPDATE "users" SET "emailVerified" = false
WHERE "email" LIKE '%@users.noreply.local' OR "email" LIKE '%@no-email.oauth.local';
