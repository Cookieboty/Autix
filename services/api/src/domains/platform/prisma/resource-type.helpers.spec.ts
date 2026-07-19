import { ResourceType } from './generated';
import { isActivatableResourceType } from '../../creation/conversation/conversation-resources.helpers';
import { isGalleryResourceType, isMetricResourceType } from './resource-type.helpers';

describe('ResourceType 边界：GALLERY_POST 只进指标，不进 marketplace 链路', () => {
  it('isGalleryResourceType 只对 GALLERY_POST 为真', () => {
    expect(isGalleryResourceType(ResourceType.GALLERY_POST)).toBe(true);
    expect(isGalleryResourceType(ResourceType.IMAGE_TEMPLATE)).toBe(false);
    expect(isGalleryResourceType(ResourceType.SKILL)).toBe(false);
  });

  it('GALLERY_POST 是指标资源类型', () => {
    expect(isMetricResourceType(ResourceType.GALLERY_POST)).toBe(true);
  });

  // 调用点（boost.service / resource-metrics.service）把 HTTP 传入的裸字符串
  // `as ResourceType` 强转后喂进来，拒绝路径是这个函数唯一的存在理由。
  it.each([
    ['未知类型', 'NOT_A_RESOURCE_TYPE'],
    ['空串', ''],
    ['大小写不符', 'gallery_post'],
    ['前后空格', ' GALLERY_POST '],
    ['原型链属性', 'toString'],
  ])('isMetricResourceType 拒绝 %s', (_label, raw) => {
    expect(isMetricResourceType(raw as ResourceType)).toBe(false);
  });

  it('GALLERY_POST 不可激活（不进 conversation 激活链路）', () => {
    expect(isActivatableResourceType(ResourceType.GALLERY_POST)).toBe(false);
    // 对照：模板仍可激活
    expect(isActivatableResourceType(ResourceType.IMAGE_TEMPLATE)).toBe(true);
  });
});
