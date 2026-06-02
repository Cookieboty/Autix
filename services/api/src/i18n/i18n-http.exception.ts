import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * An HttpException that carries an i18n message key instead of a raw string.
 * The AllExceptionsFilter will translate the key using I18nService.
 */
export class I18nHttpException extends HttpException {
  public readonly i18nKey: string;
  public readonly i18nArgs?: Record<string, any>;

  constructor(
    status: HttpStatus,
    key: string,
    args?: Record<string, any>,
  ) {
    super({ i18nKey: key, i18nArgs: args }, status);
    this.i18nKey = key;
    this.i18nArgs = args;
  }
}
