-- CreateTable
CREATE TABLE "social_login_states" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "nonce" TEXT,
    "codeVerifier" TEXT,
    "provider" TEXT NOT NULL,
    "systemCode" TEXT NOT NULL,
    "clientType" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "inviteCode" TEXT,
    "deviceId" TEXT,
    "linkUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_login_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_login_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_login_states_state_key" ON "social_login_states"("state");

-- CreateIndex
CREATE INDEX "social_login_states_expiresAt_idx" ON "social_login_states"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_login_codes_code_key" ON "social_login_codes"("code");

-- CreateIndex
CREATE INDEX "social_login_codes_expiresAt_idx" ON "social_login_codes"("expiresAt");
