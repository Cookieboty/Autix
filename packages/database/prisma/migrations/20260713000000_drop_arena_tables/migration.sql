-- Release B: 删除练武场（Arena）三张表。
--
-- ⚠ 必须在 Release A（删代码 + 删 Prisma schema）已部署完成、线上再无任何实例
--   引用 Arena 代码之后才能部署。否则滚动部署期间的旧实例会访问已被 drop 的表。
--
-- 三张表在生产库均为 0 行（已确认），直接 drop，无需归档。
-- 按 子 → 父 顺序 drop，外键约束随表一并消失。

-- DropForeignKey
ALTER TABLE "arena_responses" DROP CONSTRAINT "arena_responses_turnId_fkey";
ALTER TABLE "arena_turns" DROP CONSTRAINT "arena_turns_sessionId_fkey";
ALTER TABLE "arena_sessions" DROP CONSTRAINT "arena_sessions_userId_fkey";

-- DropTable
DROP TABLE "arena_responses";
DROP TABLE "arena_turns";
DROP TABLE "arena_sessions";
