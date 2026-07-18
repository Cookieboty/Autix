-- 直连生成：脱离 project/clip 父实体
ALTER TABLE "video_clip_generations" ALTER COLUMN "clipId" DROP NOT NULL;
ALTER TABLE "video_clip_generations" ALTER COLUMN "projectId" DROP NOT NULL;

-- 判别式硬约束：两列要么同为 NULL（直连），要么同非空（分镜）
ALTER TABLE "video_clip_generations"
  ADD CONSTRAINT "video_clip_generations_parentage_ck"
  CHECK (("clipId" IS NULL) = ("projectId" IS NULL));
