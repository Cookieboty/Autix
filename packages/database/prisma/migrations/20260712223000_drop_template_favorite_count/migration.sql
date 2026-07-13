-- Plan C Task 10: 收藏改走 FavoriteLibraryService + resource_metrics 单一来源，
-- image_templates/video_templates 自有的 favoriteCount 冗余列不再需要。
-- likeCount/useCount 暂保留（见 schema.prisma image_templates 上方注释）。
-- AlterTable
ALTER TABLE "image_templates" DROP COLUMN "favoriteCount";

-- AlterTable
ALTER TABLE "video_templates" DROP COLUMN "favoriteCount";
