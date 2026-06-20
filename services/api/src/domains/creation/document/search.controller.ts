import {
  Controller,
  Post,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import { CurrentUser, getCurrentUserId } from '../../identity/auth/decorators/current-user.decorator';
import { MembershipGuard } from '../../identity/auth/membership.guard';
import { SearchService } from './search.service';
import { LibraryFeatureGuard } from './library-feature.guard';
import type { AuthUser } from '@autix/types';

class SearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  query!: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? value : Number(value)))
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number = 5;
}

@Controller('search')
@UseGuards(JwtAuthGuard, LibraryFeatureGuard, MembershipGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async search(@CurrentUser() user: AuthUser, @Body() dto: SearchDto) {
    const userId = getCurrentUserId(user);
    return this.searchService.similaritySearch(dto.query, userId, dto.topK);
  }
}
