import { BadRequestException } from '@nestjs/common';
import { ResourceMetricsController } from './resource-metrics.controller';

/**
 * Plan C Task 10 复审安全修复：通用互动写端点（POST/DELETE /resources/:type/:id/like|favorite）
 * 必须拒绝拥有专属受守卫路由的资源类型——GALLERY_POST / IMAGE_TEMPLATE / VIDEO_TEMPLATE，
 * 否则会绕过它们各自端点上的存在性/公开可见守卫（Plan B Task 5），对未过审/SYSTEM
 * 模板刷高 resource_metrics.{favoriteCount,likeCount}（Task 10 起模板展示改读此表，漏洞变实时）。
 * SKILL/MCP/AGENT 无专属可见性守卫、合法复用通用端点，继续放行。
 */

const AUTH_USER = { id: 'user-1' } as never;

function buildController() {
  const service = {
    like: jest.fn().mockResolvedValue({ likeCount: 1 }),
    unlike: jest.fn().mockResolvedValue({ likeCount: 0 }),
    favorite: jest.fn().mockResolvedValue({ favoriteCount: 1 }),
    unfavorite: jest.fn().mockResolvedValue({ favoriteCount: 0 }),
    share: jest.fn().mockResolvedValue({ shareCount: 1 }),
    getMetrics: jest.fn().mockResolvedValue({ favoriteCount: 0, likeCount: 0 }),
  };
  const controller = new ResourceMetricsController(service as never);
  return { controller, service };
}

const DEDICATED_TYPES = ['GALLERY_POST', 'IMAGE_TEMPLATE', 'VIDEO_TEMPLATE'];
const GENERIC_TYPES = ['SKILL', 'MCP', 'AGENT'];

describe('ResourceMetricsController — 专属路由资源类型在通用写端点被拒绝', () => {
  it.each(DEDICATED_TYPES)('favorite: %s → BadRequest，且不写指标', (type) => {
    const { controller, service } = buildController();
    expect(() => controller.favorite(AUTH_USER, type, 'res-1')).toThrow(BadRequestException);
    expect(service.favorite).not.toHaveBeenCalled();
  });

  it.each(DEDICATED_TYPES)('unfavorite: %s → BadRequest，且不写指标', (type) => {
    const { controller, service } = buildController();
    expect(() => controller.unfavorite(AUTH_USER, type, 'res-1')).toThrow(BadRequestException);
    expect(service.unfavorite).not.toHaveBeenCalled();
  });

  it.each(DEDICATED_TYPES)('like: %s → BadRequest，且不写指标', (type) => {
    const { controller, service } = buildController();
    expect(() => controller.like(AUTH_USER, type, 'res-1')).toThrow(BadRequestException);
    expect(service.like).not.toHaveBeenCalled();
  });

  it.each(DEDICATED_TYPES)('unlike: %s → BadRequest，且不写指标', (type) => {
    const { controller, service } = buildController();
    expect(() => controller.unlike(AUTH_USER, type, 'res-1')).toThrow(BadRequestException);
    expect(service.unlike).not.toHaveBeenCalled();
  });
});

describe('ResourceMetricsController — SKILL/MCP/AGENT 仍走通用端点', () => {
  it.each(GENERIC_TYPES)('favorite: %s 放行并委托 service.favorite', (type) => {
    const { controller, service } = buildController();
    controller.favorite(AUTH_USER, type, 'res-1');
    expect(service.favorite).toHaveBeenCalledWith('user-1', type, 'res-1');
  });

  it.each(GENERIC_TYPES)('like: %s 放行并委托 service.like', (type) => {
    const { controller, service } = buildController();
    controller.like(AUTH_USER, type, 'res-1');
    expect(service.like).toHaveBeenCalledWith('user-1', type, 'res-1');
  });
});

describe('ResourceMetricsController.share — 模板分享仍放行（无替代路由），gallery 仍拒绝', () => {
  it('gallery share → BadRequest', () => {
    const { controller, service } = buildController();
    expect(() => controller.share('GALLERY_POST', 'g-1')).toThrow(BadRequestException);
    expect(service.share).not.toHaveBeenCalled();
  });

  it.each(['IMAGE_TEMPLATE', 'VIDEO_TEMPLATE', 'SKILL'])(
    'share: %s 放行（分享无专属路由，只计数）',
    (type) => {
      const { controller, service } = buildController();
      controller.share(type, 'res-1');
      expect(service.share).toHaveBeenCalledWith(type, 'res-1');
    },
  );
});

describe('ResourceMetricsController — 非 APPROVED/SYSTEM 模板展示计数不可经通用端点被放大', () => {
  it('攻击者对 pending IMAGE_TEMPLATE 走通用 favorite → 被拒，favoriteCount 无从改动', () => {
    const { controller, service } = buildController();
    // 通用端点无从查询模板状态，正因如此必须整类拒绝：即便目标是 PENDING/SYSTEM 模板，
    // 请求也在 service 之前被拦下，resource_metrics.favoriteCount 完全不会被写入。
    expect(() => controller.favorite(AUTH_USER, 'IMAGE_TEMPLATE', 'tpl-pending')).toThrow(
      BadRequestException,
    );
    expect(service.favorite).not.toHaveBeenCalled();
    expect(service.getMetrics).not.toHaveBeenCalled();
  });
});
