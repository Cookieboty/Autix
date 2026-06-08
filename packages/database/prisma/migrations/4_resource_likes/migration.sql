-- CreateTable
CREATE TABLE "resource_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_likes_userId_resourceType_resourceId_key" ON "resource_likes"("userId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "resource_likes_userId_createdAt_idx" ON "resource_likes"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "resource_likes" ADD CONSTRAINT "resource_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ResetLikeCounts: old anonymous likeCount data is no longer valid
UPDATE "image_templates" SET "likeCount" = 0 WHERE "likeCount" > 0;
UPDATE "video_templates" SET "likeCount" = 0 WHERE "likeCount" > 0;
UPDATE "agents" SET "likeCount" = 0 WHERE "likeCount" > 0;
UPDATE "skills" SET "likeCount" = 0 WHERE "likeCount" > 0;
UPDATE "mcp_servers" SET "likeCount" = 0 WHERE "likeCount" > 0;
