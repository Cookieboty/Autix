CREATE TABLE IF NOT EXISTS "video_project_shares" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(16) NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "video_project_shares_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "video_project_shares_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "video_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "video_project_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "video_project_shares_code_key"
  ON "video_project_shares"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "video_project_shares_projectId_userId_key"
  ON "video_project_shares"("projectId", "userId");

CREATE INDEX IF NOT EXISTS "video_project_shares_userId_createdAt_idx"
  ON "video_project_shares"("userId", "createdAt");
