import { AdminGuard } from '../../identity/auth/admin.guard';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';

@Controller()
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get('system-settings/public')
  @Public()
  async publicSettings() {
    return this.systemSettingsService.getPublicSettings();
  }

  @Get('admin/system-settings')
  @UseGuards(AdminGuard)
  async list() {
    return this.systemSettingsService.listSettings();
  }

  @Put('admin/system-settings')
  @UseGuards(AdminGuard)
  async update(@Body() body: { values?: Record<string, unknown> }) {
    return this.systemSettingsService.upsertValues(body.values ?? {});
  }
}
