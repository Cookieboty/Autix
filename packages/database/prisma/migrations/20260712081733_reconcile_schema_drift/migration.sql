-- Reconcile pre-existing schema drift: canvas_boards* tables exist in schema.prisma
-- but had no migration. Captured here as its own migration so feature migrations stay clean.

-- CreateTable
CREATE TABLE "canvas_boards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverStorageKey" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "status" TEXT NOT NULL DEFAULT 'active',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "latestStateUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_board_snapshots" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "thumbnailStorageKey" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_board_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_board_actions" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT,
    "inputNodeIds" JSONB,
    "outputNodeIds" JSONB,
    "placeholderNodeIds" JSONB,
    "request" JSONB,
    "result" JSONB,
    "error" TEXT,
    "estimatedCost" INTEGER,
    "relatedHoldId" TEXT,
    "relatedTaskId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canvas_board_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canvas_board_asset_refs" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "nodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canvas_board_asset_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canvas_boards_userId_updatedAt_idx" ON "canvas_boards"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "canvas_board_snapshots_boardId_createdAt_idx" ON "canvas_board_snapshots"("boardId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_board_snapshots_boardId_version_key" ON "canvas_board_snapshots"("boardId", "version");

-- CreateIndex
CREATE INDEX "canvas_board_actions_boardId_createdAt_idx" ON "canvas_board_actions"("boardId", "createdAt");

-- CreateIndex
CREATE INDEX "canvas_board_actions_userId_status_idx" ON "canvas_board_actions"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "canvas_board_actions_boardId_idempotencyKey_key" ON "canvas_board_actions"("boardId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "canvas_board_asset_refs_boardId_refType_idx" ON "canvas_board_asset_refs"("boardId", "refType");

-- CreateIndex
CREATE INDEX "canvas_board_asset_refs_refType_refId_idx" ON "canvas_board_asset_refs"("refType", "refId");

-- AddForeignKey
ALTER TABLE "canvas_boards" ADD CONSTRAINT "canvas_boards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_board_snapshots" ADD CONSTRAINT "canvas_board_snapshots_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "canvas_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_board_actions" ADD CONSTRAINT "canvas_board_actions_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "canvas_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canvas_board_asset_refs" ADD CONSTRAINT "canvas_board_asset_refs_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "canvas_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
