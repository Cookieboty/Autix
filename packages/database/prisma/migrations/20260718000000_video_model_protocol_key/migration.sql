-- 给现存视频模型补上 metadata.protocolKey。
--
-- 现网 Seedance 的 metadata 只有 { videoModelKind }（seed-pricing.models.ts:85）。
-- 计划 4 切 flow 后 resolveVideoPreset(metadata.protocolKey) 会拿到 undefined 并抛错 ——
-- 现有视频模型立即全部失败。此处先把数据补齐。
--
-- 只补 type='video' 且尚未声明 protocolKey 的行；已声明的不动（可能是别的渠道）。
UPDATE "model_configs"
SET "metadata" = COALESCE("metadata", '{}'::jsonb) || '{"protocolKey":"ark-video@v3"}'::jsonb
WHERE "type" = 'video'
  AND "metadata"->>'protocolKey' IS NULL;
