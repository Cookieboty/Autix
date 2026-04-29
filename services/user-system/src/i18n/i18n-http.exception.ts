import { HttpException, HttpStatus } from '@nestjs/common';

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
