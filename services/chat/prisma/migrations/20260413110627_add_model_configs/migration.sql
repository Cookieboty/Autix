-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('general', 'code', 'intent', 'embedding');

-- CreateEnum
CREATE TYPE "ModelVisibility" AS ENUM ('public', 'private');

-- CreateTable
CREATE TABLE "model_configs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(50) NOT NULL DEFAULT 'openai',
    "model" VARCHAR(100) NOT NULL,
    "type" "ModelType" NOT NULL DEFAULT 'general',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "baseUrl" VARCHAR(200),
    "apiKey" VARCHAR(200),
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "ModelVisibility" NOT NULL DEFAULT 'public',
    "createdBy" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "model_configs_type_idx" ON "model_configs"("type");

-- CreateIndex
CREATE INDEX "model_configs_isActive_idx" ON "model_configs"("isActive");

-- CreateIndex
CREATE INDEX "model_configs_isDefault_idx" ON "model_configs"("isDefault");

-- CreateIndex
CREATE INDEX "model_configs_visibility_idx" ON "model_configs"("visibility");

-- CreateIndex
CREATE INDEX "model_configs_createdBy_idx" ON "model_configs"("createdBy");
