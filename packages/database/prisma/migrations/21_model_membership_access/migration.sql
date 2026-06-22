CREATE TABLE IF NOT EXISTS "model_config_membership_levels" (
  "modelConfigId" TEXT NOT NULL,
  "levelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "model_config_membership_levels_pkey" PRIMARY KEY ("modelConfigId", "levelId"),
  CONSTRAINT "model_config_membership_levels_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "model_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "model_config_membership_levels_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "membership_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "model_config_membership_levels_levelId_idx"
  ON "model_config_membership_levels"("levelId");
