import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SystemSettingsService } from '../../platform/system-settings/system-settings.service';

@Injectable()
export class LibraryFeatureGuard implements CanActivate {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    if (!(await this.systemSettingsService.getBoolean('features.libraryEnabled'))) {
      throw new ForbiddenException('资料库功能已关闭');
    }
    return true;
  }
}
