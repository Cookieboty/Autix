-- 广场作品创作元数据：提示词 / 生成模型 / 原始像素宽高（导入或生成来源填充）。
ALTER TABLE "gallery_posts" ADD COLUMN "prompt" TEXT;
ALTER TABLE "gallery_posts" ADD COLUMN "model" VARCHAR(100);
ALTER TABLE "gallery_posts" ADD COLUMN "width" INTEGER;
ALTER TABLE "gallery_posts" ADD COLUMN "height" INTEGER;
