import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class ChatFeatureGuard implements CanActivate {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    if (!(await this.systemSettingsService.getBoolean('features.chatEnabled'))) {
      throw new ForbiddenException('Chat 功能已关闭');
    }
    return true;
  }
}
