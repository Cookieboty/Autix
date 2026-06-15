-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PointGrantType" AS ENUM ('SUBSCRIPTION', 'PURCHASED', 'GIFT', 'COMPENSATION');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PointLedgerEventType" AS ENUM (
        'subscription_grant',
        'points_purchase',
        'generation_freeze',
        'generation_cost',
        'generation_refund',
        'admin_adjustment',
        'campaign_bonus',
        'expiration',
        'migration_legacy_balance'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CampaignType" AS ENUM ('CONTINUOUS_USE', 'INVITATION', 'FEEDBACK', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "campaigns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "CampaignType" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "dailyBudget" INTEGER,
    "totalBudget" INTEGER,
    "usedBudget" INTEGER NOT NULL DEFAULT 0,
    "perUserDailyCap" INTEGER,
    "perUserTotalCap" INTEGER,
    "rewardGrantType" "PointGrantType" NOT NULL DEFAULT 'GIFT',
    "rewardSourceEvent" "PointLedgerEventType" NOT NULL DEFAULT 'campaign_bonus',
    "rewardPointsExpression" JSONB,
    "rewardExpiresInDays" INTEGER NOT NULL DEFAULT 7,
    "rewardUsageScope" JSONB,
    "eligibility" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "campaign_rewards" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerKey" TEXT NOT NULL,
    "triggerEventId" TEXT,
    "pointsGranted" INTEGER NOT NULL,
    "pointGrantId" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "campaign_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_activity_streaks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streakType" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" TIMESTAMP(3),
    "rewardedAtCycle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_activity_streaks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_code_key" ON "campaigns"("code");
CREATE INDEX IF NOT EXISTS "campaigns_status_startsAt_endsAt_idx" ON "campaigns"("status", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "campaigns_type_status_idx" ON "campaigns"("type", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_rewards_campaignId_triggerKey_key" ON "campaign_rewards"("campaignId", "triggerKey");
CREATE INDEX IF NOT EXISTS "campaign_rewards_userId_grantedAt_idx" ON "campaign_rewards"("userId", "grantedAt");
CREATE INDEX IF NOT EXISTS "campaign_rewards_campaignId_grantedAt_idx" ON "campaign_rewards"("campaignId", "grantedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "user_activity_streaks_userId_streakType_key" ON "user_activity_streaks"("userId", "streakType");
CREATE INDEX IF NOT EXISTS "user_activity_streaks_userId_updatedAt_idx" ON "user_activity_streaks"("userId", "updatedAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "campaign_rewards" ADD CONSTRAINT "campaign_rewards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "user_activity_streaks" ADD CONSTRAINT "user_activity_streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
