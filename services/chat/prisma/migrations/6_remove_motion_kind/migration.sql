-- Delete agents with kind = 'motion'
DELETE FROM "agents" WHERE "kind" = 'motion';

-- Drop default, swap enum, restore default
ALTER TABLE "agents" ALTER COLUMN "kind" DROP DEFAULT;

ALTER TYPE "AgentKind" RENAME TO "AgentKind_old";
CREATE TYPE "AgentKind" AS ENUM ('chat', 'image', 'video', 'avatar');
ALTER TABLE "agents" ALTER COLUMN "kind" TYPE "AgentKind" USING "kind"::text::"AgentKind";
DROP TYPE "AgentKind_old";

ALTER TABLE "agents" ALTER COLUMN "kind" SET DEFAULT 'chat';
