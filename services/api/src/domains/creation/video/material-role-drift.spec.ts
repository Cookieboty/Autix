import { VIDEO_MATERIAL_ROLES } from '@autix/domain/video';
import { VideoMaterialRole } from '../../platform/prisma/generated';

// domain 的 VIDEO_MATERIAL_ROLES 是 Prisma 枚举的纯字符串镜像（domain 与 ai-adapters
// 都不依赖 @autix/database，且适配层按设计不认识 Prisma）。
// 镜像一旦漂移就是静默故障：Prisma 加了第六个角色，引擎的 roleItems 不覆盖它 ->
// 该角色的素材在组装时抛错（或更糟，被静默丢弃）。这里是唯一能挡住漂移的地方。
describe('VideoMaterialRole mirror', () => {
  it('stays in sync with the Prisma enum', () => {
    expect([...VIDEO_MATERIAL_ROLES].sort()).toEqual(Object.values(VideoMaterialRole).sort());
  });
});
