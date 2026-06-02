import { Controller, Get, Put, Param, Body, Query } from '@nestjs/common';
import { RegistrationService } from './registration.service';
import { ProcessRegistrationDto } from './dto/process-registration.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '@autix/types';

@Controller('registrations')
export class RegistrationController {
  constructor(private registrationService: RegistrationService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('systemId') systemId?: string,
    @Query('status') status?: string,
  ): Promise<any> {
    return this.registrationService.findAll(user, systemId, status);
  }

  @Get('pending-count')
  async getPendingCount(@CurrentUser() user: AuthUser) {
    const count = await this.registrationService.getPendingCount(user);
    return { count };
  }

  @Put(':id/approve')
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ProcessRegistrationDto,
  ) {
    return this.registrationService.approve(id, user, dto);
  }

  @Put(':id/reject')
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ProcessRegistrationDto,
  ) {
    return this.registrationService.reject(id, user, dto);
  }
}
