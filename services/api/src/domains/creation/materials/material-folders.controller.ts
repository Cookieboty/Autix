import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { MaterialFoldersService } from './material-folders.service';
import type { AuthUser } from '@autix/domain';

@UseGuards(JwtAuthGuard)
@Controller('material-folders')
export class MaterialFoldersController {
  constructor(private readonly service: MaterialFoldersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.listSidebar(getCurrentUserId(user));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { name: string }) {
    return this.service.create(getCurrentUserId(user), body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number },
  ) {
    return this.service.update(getCurrentUserId(user), id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(getCurrentUserId(user), id);
  }
}
