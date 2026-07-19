-- 删除第一代视频生成表 video_generations。
--
-- 它从来没有产出过一个视频：全仓不存在任何针对它的 UPDATE，行以 status='pending'
-- 建立后永远停在那里，generatedVideos 恒为空数组。结构上它也接不了回调
-- （没有 providerTaskId / protocolKey 两列）。唯一的写入口
-- POST /video-templates/:id/generations 已停用（它会扣费但不产出）。
--
-- 现役实现是 video_clip_generations：/ai/video 直连、工作台分镜、聊天生成三条
-- 链路全走它，gallery 的视频投稿归属校验也已改指它。
--
-- 安全性：无任何表的外键指向本表（grep 'REFERENCES "video_generations"' 零命中）；
-- gallery_posts.videoGenerationId 是无约束的普通列，语义已迁到 clip 表，不受影响。
-- 执行前本表 0 行。
--
-- generation_turns 与生成记录是无外键的多态关联，generationType='VIDEO_TEMPLATE'
-- 的行删表后会成为孤儿，一并清掉（执行前该表整体 0 行）。

DELETE FROM "generation_turns" WHERE "generationType" = 'VIDEO_TEMPLATE';

DROP TABLE IF EXISTS "video_generations";
