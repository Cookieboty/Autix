-- AlterTable: record the irreversible account deletion timestamp
ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
