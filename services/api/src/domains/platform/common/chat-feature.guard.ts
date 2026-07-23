import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { I18nHttpException } from '../i18n/i18n-http.exception';

@Injectable()
export class ChatFeatureGuard implements CanActivate {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    if (!(await this.systemSettingsService.getBoolean('features.chatEnabled'))) {
      throw new I18nHttpException(HttpStatus.FORBIDDEN, 'feature.chat_disabled');
    }
    return true;
  }
}
