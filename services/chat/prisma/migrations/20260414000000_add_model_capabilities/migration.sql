-- Add capabilities field to model_configs table
-- This field stores the model's perception capabilities as an array of tags.
-- Recommended values: text | vision | voice | speech | code | reasoning | image | embedding
ALTER TABLE "model_configs" ADD COLUMN "capabilities" TEXT[] NOT NULL DEFAULT ARRAY['text']::TEXT[];
