'use client';

/**
 * 右栏空态的视觉部分：三张错落的演示视频卡 + 底部品牌色微光。
 * Gallery 与 History 共用，避免两处各写一份、样式漂移。
 */

/** 演示片源，与首页同一批 CDN 素材 */
const SHOWCASE_VIDEOS = [
  'https://cdn.amux.ai/playground/video/video/demo/1770627047985_WYEvEd7j.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/action-v2-mini.mp4',
  'https://cdn.amux.ai/playground/video/video/demo/short-film-mini.mp4',
];

/** 扇形排布：中间那张正面居前，两侧后退并外旋 */
const CARD_LAYOUT = [
  { x: -104, rotate: -8, z: 1, scale: 0.92, opacity: 0.72 },
  { x: 0, rotate: 0, z: 3, scale: 1, opacity: 1 },
  { x: 104, rotate: 8, z: 2, scale: 0.92, opacity: 0.85 },
];

export function VideoEmptyShowcase({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-[46vh] place-items-center px-6 py-10">
      <div className="growth-rise-in flex flex-col items-center text-center">
        <div className="relative mb-8 h-[168px] w-[300px]">
          {SHOWCASE_VIDEOS.map((src, index) => {
            const card = CARD_LAYOUT[index]!;
            return (
              <div
                key={src}
                className="absolute left-1/2 top-1/2 h-[148px] w-[104px] overflow-hidden rounded-[12px] border-2 border-white/85 bg-black/50 shadow-[0_16px_46px_rgba(0,0,0,0.55)]"
                style={{
                  transform: `translate(-50%,-50%) translateX(${card.x}px) rotate(${card.rotate}deg) scale(${card.scale})`,
                  zIndex: card.z,
                  opacity: card.opacity,
                }}
              >
                {/* 三个视频同时播放，都是短循环片段；muted+playsInline 是自动播放的硬性要求 */}
                <video
                  src={src}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                  className="size-full object-cover"
                />
                {/* 压暗：空态的主角是下方文案，视频只是背景氛围，不压暗会喧宾夺主 */}
                <span className="pointer-events-none absolute inset-0 bg-black/45" />
              </div>
            );
          })}
          {/* 底部一圈品牌色微光，避免大片纯黑显得空 */}
          <div className="pointer-events-none absolute inset-x-8 bottom-1 h-16 rounded-full bg-growth-accent/12 blur-[44px]" />
        </div>
        <p className="text-base font-bold text-foreground">{title}</p>
        <p className="mt-1.5 max-w-xs text-sm leading-6 text-foreground/45">{description}</p>
      </div>
    </div>
  );
}
