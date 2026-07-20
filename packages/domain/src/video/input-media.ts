/**
 * 视频模型的**输入媒体能力**声明。
 *
 * 与 capabilities.ts 里那张表的区别：那张表描述的是「产出什么」（分辨率/时长/画幅），
 * 这里描述的是「能喂进去什么」（参考图 / 参考视频 / 参考音频，各自几个、多长）。
 *
 * 为什么要有这层：在此之前后端完全没有表达过它，前端只能对所有模型一律给出
 * 「图片 / 视频 / 音频」三个上传入口。而实际上 10 个视频模型里只有 2 个接视频、
 * 2 个接音频 —— 其余模型用户传上去的东西是**必然失败**的，还要先扣一次上传的时间和
 * 存储。这层声明就是为了把那些必然失败的入口关掉。
 *
 * 声明放在各模型的 `paramsSchema['x-media']` 里，而不是 capabilities.ts：
 * 后者按 VideoModelKind 索引，而 Wan / Grok / Happy Horse 全都落在 'compatible' 这一档，
 * 表达不了逐模型差异；paramsSchema 本来就是按 model-id 存的，且已经随
 * `getTaskModels` 下发到前端，不用另开一条传输通道。
 */

/** 参考图在各家协议里的语义位。用于提示用户「这张图会被当成什么用」。 */
export type VideoImageRole =
  /** 首帧（image-to-video 的起点） */
  | 'first_frame'
  /** 尾帧（与首帧配对，生成两帧之间的过渡） */
  | 'last_frame'
  /** 参考图（提取主体/风格，不作为画面起点） */
  | 'reference_image';

export interface VideoMediaSlot {
  /** 该类型最多可选几个。0 或缺省 = 不支持该类型。 */
  max: number;
  /** 单个素材的时长上限（秒）。视频/音频用；缺省表示上游没有明确限制。 */
  maxSeconds?: number;
  /** 该类型所有素材的时长总和上限（秒）。 */
  totalSeconds?: number;
}

export interface VideoImageSlot extends VideoMediaSlot {
  /** 该模型认哪些图片语义位。空数组表示只接受笼统的「参考图」。 */
  roles?: VideoImageRole[];
  /** 必须恰好给这么多张（如 Grok 1.5 的「恰好 1 张」）。缺省表示 0..max 均可。 */
  exact?: number;
}

/**
 * 图片输入的互斥模式。
 *
 * 典型是 Seedance：首帧 / 首+尾帧 / 参考图(1-9) 三种用法**不能在同一次任务里混用**；
 * Happy Horse 则是 image_urls 与 reference_image_urls 二选一。
 * 值是模式名列表，同一时刻只能命中一种。
 */
export type VideoImageModeGroup = VideoImageRole[][];

export interface VideoInputMediaCapability {
  image?: VideoImageSlot;
  video?: VideoMediaSlot;
  audio?: VideoMediaSlot;
  /** 图片语义位之间的互斥分组（缺省 = 无互斥）。 */
  imageModes?: VideoImageModeGroup;
}

/** paramsSchema 上承载它的键名。前后端共用同一个常量，别再各写一遍字符串。 */
export const VIDEO_INPUT_MEDIA_KEY = 'x-media' as const;

/** 该模型是否接受某类输入媒体。缺省一律按「不支持」处理 —— 保守方向是关掉入口。 */
export function acceptsVideoInputMedia(
  capability: VideoInputMediaCapability | undefined,
  type: 'image' | 'video' | 'audio',
): boolean {
  return (capability?.[type]?.max ?? 0) > 0;
}

/** 从任意 paramsSchema 上把 x-media 读出来（形状不对时返回 undefined，调用方按不支持处理）。 */
export function readVideoInputMedia(
  paramsSchema: unknown,
): VideoInputMediaCapability | undefined {
  const raw = (paramsSchema as Record<string, unknown> | null | undefined)?.[
    VIDEO_INPUT_MEDIA_KEY
  ];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as VideoInputMediaCapability;
}
