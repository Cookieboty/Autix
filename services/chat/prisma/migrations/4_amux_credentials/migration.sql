-- amux_credentials: 用户授权的 Amux OAT 凭证
CREATE TABLE "amux_credentials" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "host" VARCHAR(500) NOT NULL,
  "oat" VARCHAR(500) NOT NULL,
  "amuxUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "amux_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "amux_credentials_userId_key" ON "amux_credentials"("userId");
