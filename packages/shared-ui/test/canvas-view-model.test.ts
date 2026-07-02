import { describe, expect, it } from 'bun:test';
import type { CanvasActionEstimate, CanvasNode } from '@autix/domain';
import {
  actionLabel,
  estimateBadge,
  reasonText,
  saveIndicatorText,
  summarizeSelection,
} from '../src/canvas/canvas-view-model';

const promptNode: CanvasNode = {
  id: 'p',
  kind: 'prompt',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  createdAt: 't',
  updatedAt: 't',
  prompt: 'hello',
};

const imageNode: CanvasNode = {
  id: 'i',
  kind: 'image',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  createdAt: 't',
  updatedAt: 't',
  assetRef: { type: 'image_generation', generationId: 'g' },
};

describe('canvas-view-model', () => {
  it('labels action types in Chinese', () => {
    expect(actionLabel('image-generate')).toBe('生成图片');
    expect(actionLabel('storyboard-from-selection')).toBe('生成分镜');
  });

  it('formats each estimate kind', () => {
    expect(estimateBadge({ kind: 'exact', cost: 19 })).toBe('预计 19');
    expect(estimateBadge({ kind: 'range', minCost: 5, maxCost: 20 } as CanvasActionEstimate)).toBe('预计 5–20');
    expect(estimateBadge({ kind: 'metered' })).toBe('按用量计费');
    expect(estimateBadge(null)).toBe('');
  });

  it('maps reason codes to hints', () => {
    expect(reasonText('membership_required')).toContain('会员');
    expect(reasonText('needs_prompt')).toContain('Prompt');
  });

  it('summarizes a mixed selection', () => {
    const s = summarizeSelection([promptNode, imageNode], ['p', 'i']);
    expect(s).toMatchObject({ total: 2, prompts: 1, images: 1 });
  });

  it('renders save indicator text', () => {
    expect(saveIndicatorText('saving')).toBe('保存中…');
    expect(saveIndicatorText('conflict')).toContain('最新');
  });
});
