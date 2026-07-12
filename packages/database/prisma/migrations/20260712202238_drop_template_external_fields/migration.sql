-- AlterTable
ALTER TABLE "image_templates" DROP COLUMN "authorName",
DROP COLUMN "authorUrl",
DROP COLUMN "externalId",
DROP COLUMN "externalMetadata",
DROP COLUMN "externalSlug",
DROP COLUMN "originalUrl",
DROP COLUMN "sourcePlatform";

-- AlterTable
ALTER TABLE "video_templates" DROP COLUMN "authorName",
DROP COLUMN "authorUrl",
DROP COLUMN "externalId",
DROP COLUMN "externalMetadata",
DROP COLUMN "externalSlug",
DROP COLUMN "originalUrl",
DROP COLUMN "sourcePlatform";

