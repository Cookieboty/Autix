-- CreateEnum
CREATE TYPE "AgentKind" AS ENUM ('chat', 'image', 'video', 'avatar', 'motion');

-- AlterTable: add column with default, backfill existing rows
ALTER TABLE "agents" ADD COLUMN "kind" "AgentKind" NOT NULL DEFAULT 'chat';
