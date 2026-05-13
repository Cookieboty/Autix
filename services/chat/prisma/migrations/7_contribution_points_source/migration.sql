-- Add CONTRIBUTION to PointsSource enum
ALTER TYPE "PointsSource" ADD VALUE IF NOT EXISTS 'CONTRIBUTION';

-- Seed template_publish_reward task cost
INSERT INTO "task_point_costs" ("id", "taskType", "name", "cost", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'template_publish_reward', '模板发布奖励', 5, true, now(), now())
ON CONFLICT ("taskType") DO NOTHING;
