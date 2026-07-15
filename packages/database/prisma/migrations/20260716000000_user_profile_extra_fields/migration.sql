-- 账户设置「编辑资料」弹框新增可自助编辑的档案字段：
-- headline（一句话标题）、location（所在地）、以及四个社交平台链接/handle。
-- 全部可空、纯展示性，不参与登录/唯一性约束；长度上限与 domain OWN_PROFILE_LIMITS 对齐。
ALTER TABLE "users"
  ADD COLUMN "headline"        VARCHAR(80),
  ADD COLUMN "location"        VARCHAR(80),
  ADD COLUMN "socialX"         VARCHAR(200),
  ADD COLUMN "socialInstagram" VARCHAR(200),
  ADD COLUMN "socialYoutube"   VARCHAR(200),
  ADD COLUMN "socialTiktok"    VARCHAR(200);
