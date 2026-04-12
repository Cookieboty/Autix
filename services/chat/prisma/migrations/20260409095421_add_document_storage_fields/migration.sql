/*
  Warnings:

  - Added the required column `size` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "storageBucket" TEXT,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "storageRegion" TEXT,
ADD COLUMN     "storageType" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "storageUrl" TEXT;
