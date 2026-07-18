'use client';

import { useEffect, useState } from 'react';
import {
  hasImageCapability,
  listPublicAvailableModels,
  type ModelConfigItem,
} from '@autix/shared-store';

/**
 * 公开图片模型列表的共享数据层。导航「Image」悬浮下拉、首页 Explore 标签、页尾 Image 列
 * 都消费同一份数据与同一套跳转约定，避免各处硬编码模型名导致口径不一 / 预选失败。
 *
 * 模块级缓存 + inflight 去重：整个会话多处、多次挂载只发一次公开模型请求。
 */
let cachedImageModels: ModelConfigItem[] | null = null;
let inflight: Promise<ModelConfigItem[]> | null = null;

export function loadImageModels(): Promise<ModelConfigItem[]> {
  if (cachedImageModels) return Promise.resolve(cachedImageModels);
  if (!inflight) {
    inflight = listPublicAvailableModels()
      .then((models) => {
        const list = models.filter((model) => hasImageCapability(model.capabilities ?? []));
        cachedImageModels = list;
        return list;
      })
      .catch(() => {
        // 失败不缓存，下次再试
        inflight = null;
        return [];
      });
  }
  return inflight;
}

/** 公开图片模型 hook：首帧用缓存（有则直出），否则挂载后拉取一次。 */
export function useImageNavModels(): ModelConfigItem[] {
  const [models, setModels] = useState<ModelConfigItem[]>(() => cachedImageModels ?? []);
  useEffect(() => {
    let cancelled = false;
    if (!cachedImageModels) {
      void loadImageModels().then((list) => {
        if (!cancelled) setModels(list);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return models;
}

/**
 * 模型名 → URL 参数：空格转下划线（`Nano Banana 2` → `Nano_Banana_2`），得到干净的语义化链接。
 * page 侧无需反解析——findImageModelByHint 归一化时会剥掉下划线/空格，
 * `nano_banana_2` 与 `Nano Banana 2` 归一化后同为 `nanobanana2`，精确匹配即命中。
 */
export function toModelParam(name: string): string {
  return encodeURIComponent(name.trim().replace(/\s+/g, '_'));
}

/** 图片模型跳转地址：`/ai/image?model=<模型名，空格转下划线>` */
export function imageModelHref(name: string): string {
  return `/ai/image?model=${toModelParam(name)}`;
}

/**
 * 导航 Image 下拉的 Features 三项（key 对应 `publicGrowth.imageNavFlyout` 文案）。
 * 前两项进 image 页，最后一项进 image 页的 gallery 模式。
 */
export const IMAGE_NAV_FEATURES = [
  { key: 'createImage', href: '/ai/image' },
  { key: 'editImage', href: '/ai/image' },
  { key: 'gallery', href: '/ai/image?mode=gallery' },
] as const;

export type ImageNavFeatureKey = (typeof IMAGE_NAV_FEATURES)[number]['key'];
