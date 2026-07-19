'use client';

import { useEffect, useState } from 'react';
import {
  isVideoModel,
  listPublicAvailableModels,
  type ModelConfigItem,
} from '@autix/shared-store';
import { toModelParam } from './image-nav';

/**
 * 公开视频模型列表的共享数据层，与 image-nav 同构。
 *
 * 模块级缓存 + inflight 去重：整个会话多处、多次挂载只发一次公开模型请求。
 * 两侧各自缓存而非共用一份原始列表——请求本身在 SDK 层已按 URL 复用，
 * 这里缓存的是「过滤后的结果」，各自持有更直白。
 */
let cachedVideoModels: ModelConfigItem[] | null = null;
let inflight: Promise<ModelConfigItem[]> | null = null;

export function loadVideoModels(): Promise<ModelConfigItem[]> {
  if (cachedVideoModels) return Promise.resolve(cachedVideoModels);
  if (!inflight) {
    inflight = listPublicAvailableModels()
      .then((models) => {
        const list = models.filter(isVideoModel);
        cachedVideoModels = list;
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

/** 公开视频模型 hook：首帧用缓存（有则直出），否则挂载后拉取一次。 */
export function useVideoNavModels(): ModelConfigItem[] {
  const [models, setModels] = useState<ModelConfigItem[]>(() => cachedVideoModels ?? []);
  useEffect(() => {
    let cancelled = false;
    if (!cachedVideoModels) {
      void loadVideoModels().then((list) => {
        if (!cancelled) setModels(list);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return models;
}

/** 视频模型跳转地址：`/ai/video?model=<模型名，空格转下划线>` */
export function videoModelHref(name: string): string {
  return `/ai/video?model=${toModelParam(name)}`;
}

/**
 * 导航 Video 下拉的 Features（key 对应 `publicGrowth.videoNavFlyout` 文案）。
 * gallery 项与 image 页**共用同一个 `?mode=gallery` 参数** —— 早期 video 用的是
 * `?tab=gallery`，两边规则不一致会让用户在两个页面间来回切时发现地址栏规律对不上，
 * 已统一。这里若漏改，点进去只会落到默认的 history tab。
 */
export const VIDEO_NAV_FEATURES = [
  { key: 'createVideo', href: '/ai/video' },
  { key: 'gallery', href: '/ai/video?mode=gallery' },
] as const;

export type VideoNavFeatureKey = (typeof VIDEO_NAV_FEATURES)[number]['key'];
