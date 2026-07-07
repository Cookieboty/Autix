-- DropForeignKey
ALTER TABLE "home_section_items" DROP CONSTRAINT "home_section_items_creationId_fkey";

-- DropForeignKey
ALTER TABLE "public_creation_likes" DROP CONSTRAINT "public_creation_likes_creationId_fkey";

-- DropForeignKey
ALTER TABLE "public_creation_likes" DROP CONSTRAINT "public_creation_likes_userId_fkey";

-- DropForeignKey
ALTER TABLE "public_creations" DROP CONSTRAINT "public_creations_userId_fkey";

-- DropIndex
DROP INDEX "home_section_items_creationId_idx";

-- AlterTable
ALTER TABLE "home_section_items" DROP COLUMN "creationId";

-- DropTable
DROP TABLE "public_creation_likes";

-- DropTable
DROP TABLE "public_creations";
