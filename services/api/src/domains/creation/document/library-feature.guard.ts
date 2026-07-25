import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { SystemSettingsService } from '../../platform/system-settings/system-settings.service';
import { I18nHttpException } from '../../platform/i18n/i18n-http.exception';

@Injectable()
export class LibraryFeatureGuard implements CanActivate {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    if (!(await this.systemSettingsService.getBoolean('features.libraryEnabled'))) {
      throw new I18nHttpException(HttpStatus.FORBIDDEN, 'document.library_disabled');
    }
    return true;
  }
}
