-- 1. 列改名
ALTER TABLE "video_clip_generations" RENAME COLUMN "seedanceTaskId" TO "providerTaskId";

-- 2. 快照列
ALTER TABLE "video_clip_generations" ADD COLUMN "protocolKey" VARCHAR(64);
ALTER TABLE "video_clip_generations" ADD COLUMN "modelConfigId" TEXT;

-- 3. 回填 protocolKey（存量任务全部是 seedance）
UPDATE "video_clip_generations"
SET "protocolKey" = 'ark-video@v3'
WHERE "providerTaskId" IS NOT NULL;

-- 4. 回填 modelConfigId —— 从 point_holds 快照。
--    buildVideoHoldInput 里 taskId 就是 generationId，metadata 含 modelConfigId。
--    必须限定 taskType：point_holds 是 @@index([taskType, taskId])，taskId 单列不唯一，
--    只按 taskId 连接既用不上复合索引，也可能与其他任务类型的 hold 碰撞。
--    多条匹配时取最新一条，保证结果确定。
UPDATE "video_clip_generations" g
SET "modelConfigId" = h."modelConfigId"
FROM (
  SELECT DISTINCT ON ("taskId")
         "taskId",
         "metadata"->>'modelConfigId' AS "modelConfigId"
  FROM "point_holds"
  WHERE "taskType" = 'video_generation'
    AND "metadata"->>'modelConfigId' IS NOT NULL
  ORDER BY "taskId", "createdAt" DESC
) h
WHERE h."taskId" = g."id"
  AND g."providerTaskId" IS NOT NULL;

-- 5. 新复合索引
CREATE INDEX "video_clip_generations_protocolKey_providerTaskId_idx"
  ON "video_clip_generations" ("protocolKey", "providerTaskId");

-- 6. 删除旧单列索引。RENAME COLUMN 既不会删它，也不会改它的名字 ——
--    残留的旧名会让 Prisma 后续 introspect/migrate 产生漂移。
DROP INDEX "video_clip_generations_seedanceTaskId_idx";
