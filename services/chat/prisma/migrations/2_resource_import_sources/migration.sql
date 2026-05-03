-- Preserve real author inputs for MCP configs and SKILL.md based publishing.

ALTER TABLE "skills"
  ADD COLUMN "rawMarkdown" TEXT,
  ADD COLUMN "sourceFormat" VARCHAR(50) NOT NULL DEFAULT 'skill_md',
  ADD COLUMN "parsedFrontmatter" JSONB;

ALTER TABLE "mcp_servers"
  ADD COLUMN "rawConfig" JSONB,
  ADD COLUMN "configFormat" VARCHAR(50) NOT NULL DEFAULT 'mcp_json',
  ADD COLUMN "headersSchema" JSONB,
  ADD COLUMN "authSchema" JSONB,
  ADD COLUMN "tools" JSONB,
  ADD COLUMN "capabilities" JSONB,
  ADD COLUMN "installNotes" TEXT,
  ADD COLUMN "securityNotes" TEXT;
