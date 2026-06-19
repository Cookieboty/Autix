-- Prevent duplicate point grants for the same business source, especially order fulfillment.
-- PostgreSQL allows multiple NULL values in unique indexes, so admin/manual grants without a
-- sourceId remain unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "point_grants_sourceEvent_sourceId_key"
  ON "point_grants"("sourceEvent", "sourceId")
  WHERE "sourceId" IS NOT NULL;
