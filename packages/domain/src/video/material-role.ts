// 视频素材角色。
//
// 这是 Prisma 枚举 VideoMaterialRole（packages/database/prisma/schema.prisma:1750）的
// **纯字符串镜像**。为什么要镜像而不是直接用 Prisma 的：
//   - packages/domain 与 packages/ai-adapters 都不依赖 @autix/database；
//   - 协议适配层按设计不认识 Prisma（设计 §3.2 边界一）。
// 漂移守卫在 services/api 侧（material-role-drift.spec.ts）—— 只有那里同时看得见两者。

/** 运行时白名单。TS 联合会被类型擦除，引擎需要能在运行时穷举角色。 */
export const VIDEO_MATERIAL_ROLES = [
  'first_frame',
  'last_frame',
  'reference_image',
  'reference_video',
  'reference_audio',
] as const;

export type VideoMaterialRole = typeof VIDEO_MATERIAL_ROLES[number];
