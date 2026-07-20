/**
 * 首页模型卡片里**确实已接入**的模型名。
 *
 * 首页那两组卡（顶部滑动区 / 下方能力卡）是手写的展示数据，会先于接入把新模型摆上去
 * 做预告。问题出在跳转：带一个库里匹配不到的 `?model=` hint，落地页
 * （findVideo/ImageModelByHint）匹配失败后会静默回落到默认模型 —— 用户点的是 A、
 * 打开却是 B，看起来像点错了或者页面坏了。
 *
 * 所以跳转前先过这张表：**在表里的按模型名精确跳转，不在表里的只进落地页、不带参数**。
 * 后者至少是诚实的「这个还没接」，而不是假装选中了。
 *
 * 名字必须与 model_configs.name 逐字一致（归一化只做小写 + 去非字母数字，
 * 见 generator-*-presenters 的 normalizeModelHint）。接入新模型时把名字加进来即可。
 */
export const KNOWN_MODEL_TITLES = new Set<string>([
  // 视频
  'Seedance 2.0',
  // 图片
  'Nano Banana 2 Lite',
  'Nano Banana Pro',
  'Nano Banana 2',
  'GPT Image 2',
  'Seedream 5.0 Lite',
  'Seedream 4.5',
]);
