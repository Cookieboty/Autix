-- 文件夹自定义图标（emoji）。
--
-- /asset 的文件夹标题左侧可点图标换 emoji，选完要入库——否则刷新即丢。
-- 存 emoji 字面量而不是 shortcode（:smile:）：渲染端直接就是文本，
-- 不需要在前端再挂一张 shortcode→字符 的映射表。
--
-- VarChar(16) 而不是 (2)：一个 emoji 可能由多个码位组成（肤色修饰、ZWJ 组合序列，
-- 如 👩‍🎨 是 4 个码位 / 11 字节），按「一个字符」估容量会直接截断存不进去。
--
-- 可空：老文件夹没有图标，渲染端回退到默认的文件夹图形；不给默认值，
-- 以便区分「没设过」与「设成了某个 emoji」。
ALTER TABLE "material_folders"
  ADD COLUMN "icon" VARCHAR(16);
