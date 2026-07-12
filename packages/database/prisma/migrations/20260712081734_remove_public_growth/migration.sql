/*
  Remove the public-growth domain: creator profiles/follows, growth events,
  growth pages, home sections, public collections, and their enums.
*/
-- DropForeignKey
ALTER TABLE "creator_follows" DROP CONSTRAINT "creator_follows_creatorUserId_fkey";

-- DropForeignKey
ALTER TABLE "creator_follows" DROP CONSTRAINT "creator_follows_followerId_fkey";

-- DropForeignKey
ALTER TABLE "creator_profiles" DROP CONSTRAINT "creator_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "growth_events" DROP CONSTRAINT "growth_events_userId_fkey";

-- DropForeignKey
ALTER TABLE "home_section_items" DROP CONSTRAINT "home_section_items_sectionId_fkey";

-- DropTable
DROP TABLE "creator_follows";

-- DropTable
DROP TABLE "creator_profiles";

-- DropTable
DROP TABLE "growth_events";

-- DropTable
DROP TABLE "growth_pages";

-- DropTable
DROP TABLE "home_section_items";

-- DropTable
DROP TABLE "home_sections";

-- DropTable
DROP TABLE "public_collections";

-- DropEnum
DROP TYPE "GrowthPageStatus";

-- DropEnum
DROP TYPE "HomeSectionType";

-- DropEnum
DROP TYPE "PublicCollectionKind";

-- DropEnum
DROP TYPE "PublicCollectionStatus";

-- DropEnum
DROP TYPE "PublicCreationMediaType";

-- DropEnum
DROP TYPE "PublicCreationSourceType";

-- DropEnum
DROP TYPE "PublicCreationStatus";

-- DropEnum
DROP TYPE "PublicPromptVisibility";
