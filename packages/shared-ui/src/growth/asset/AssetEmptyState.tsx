'use client';

import { useTranslations } from 'next-intl';

/**
 * 空状态：三张竖长方形样片扇形铺开 + 主文案 + 提示，整体在大卡片里居中，由下向上渐显。
 */

/** 三张样片。竖长方形（宽窄高长），中间那张压在最上层、两侧向外扇开。 */
const SAMPLES = [
  {
    url: 'https://cdn.amux.ai/background/a1104d22cdfd11f0ba0900163e56377f~tplv-d77oumduh0-watermark_ai.jpg',
    rotate: -9,
    x: -72,
    z: 1,
  },
  {
    url: 'https://cdn.amux.ai/background/e71ada1e05b011f1bd68b8599f1d1fe2~tplv-d77oumduh0-watermark_ai.jpg',
    rotate: 0,
    x: 0,
    z: 3,
  },
  { url: 'https://cdn.amux.ai/background/123.webp', rotate: 9, x: 72, z: 2 },
];

export function AssetEmptyState() {
  const t = useTranslations('publicGrowth.assets');

  return (
    // h-full + place-items-center：在整张大卡片里居中，而不是靠顶部留白顶下来。
    <div className="grid h-full place-items-center">
      <div className="growth-rise-in flex flex-col items-center text-center">
        <div className="relative mb-7 h-[160px] w-[280px]">
          {SAMPLES.map((sample) => (
            <div
              key={sample.url}
              // 仍是竖长方形，但比例收敛到 ~4:5——原来的 126×184 太瘦高，压过了下面的文案。
              className="absolute left-1/2 top-1/2 h-[136px] w-[110px] overflow-hidden rounded-xl border-[3px] border-white bg-[rgb(28,30,32)] shadow-[0_14px_44px_rgba(0,0,0,0.5)]"
              style={{
                transform: `translate(-50%, -50%) translateX(${sample.x}px) rotate(${sample.rotate}deg)`,
                zIndex: sample.z,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sample.url} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>

        <p className="text-base font-semibold text-foreground">{t('empty.title')}</p>
        <p className="mt-1.5 text-sm text-foreground/45">{t('empty.description')}</p>
      </div>
    </div>
  );
}
