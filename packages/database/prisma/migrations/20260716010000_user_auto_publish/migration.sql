-- 个人中心「Auto-publish new generations」开关的持久化字段。
-- 作为 /ai/image 生成器隐私按钮的默认可见性来源；可空语义上不需要，默认 false（private）。
-- 老用户回填 false，行为与改动前一致。
ALTER TABLE "users"
  ADD COLUMN "autoPublish" BOOLEAN NOT NULL DEFAULT false;
