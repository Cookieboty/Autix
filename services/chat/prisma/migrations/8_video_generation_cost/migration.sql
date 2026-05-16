-- Plan-3: Seed task_point_costs row for video generation pre-charge.
-- Idempotent: safe to re-apply.
INSERT INTO "task_point_costs" ("id", "taskType", "name", "cost", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'video_generation', '视频生成', 10, true, now(), now())
ON CONFLICT ("taskType") DO NOTHING;
