-- AlterEnum
ALTER TYPE "RegistrationStatus" ADD VALUE 'PENDING_ACTIVATION';

-- AlterTable
ALTER TABLE "systems" ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;
