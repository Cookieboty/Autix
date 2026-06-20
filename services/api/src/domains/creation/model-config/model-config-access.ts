import { ForbiddenException } from '@nestjs/common';

type SystemSettingsLike = {
  getBoolean(key: string): Promise<boolean>;
};

export async function assertModelConfigEnabled(
  systemSettingsService: SystemSettingsLike,
) {
  if (!(await systemSettingsService.getBoolean('features.modelConfigEnabled'))) {
    throw new ForbiddenException('模型配置功能已关闭');
  }
}
