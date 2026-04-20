-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('MARKDOWN', 'CODE', 'DOCUMENT', 'TABLE', 'CHART');

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL DEFAULT 'MARKDOWN',
    "language" TEXT,
    "content" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_versions" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changelog" TEXT,
    "sourcetags" TEXT[],
    "sourceMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_conversationId_key" ON "artifacts"("conversationId");

-- CreateIndex
CREATE INDEX "artifacts_userId_idx" ON "artifacts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_versions_artifactId_version_key" ON "artifact_versions"("artifactId", "version");

-- CreateIndex
CREATE INDEX "artifact_versions_artifactId_createdAt_idx" ON "artifact_versions"("artifactId", "createdAt");

-- CreateIndex
CREATE INDEX "artifact_versions_artifactId_sourcetags_idx" ON "artifact_versions"("artifactId", "sourcetags");

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
