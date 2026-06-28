-- Drop legacy generation_pricing_rules columns left over on environments that
-- were baselined from an old `db push` schema (before the pricing redesign).
-- Idempotent: no-op on DBs already built from the current migrations/schema.
-- Removing these is intentional (the columns were replaced by the new pricing
-- model); it clears the only destructive diff so the plain `db push` reconcile
-- step can then heal the remaining additive drift without --accept-data-loss.
ALTER TABLE "generation_pricing_rules"
  DROP COLUMN IF EXISTS "allowedMembershipLevels",
  DROP COLUMN IF EXISTS "baseCost",
  DROP COLUMN IF EXISTS "disallowedGrantTypes",
  DROP COLUMN IF EXISTS "fixedExtraCost",
  DROP COLUMN IF EXISTS "inputTokenCostPerK",
  DROP COLUMN IF EXISTS "modelTier",
  DROP COLUMN IF EXISTS "outputTokenCostPerK",
  DROP COLUMN IF EXISTS "quality",
  DROP COLUMN IF EXISTS "reasoningMultiplier",
  DROP COLUMN IF EXISTS "resolution";
