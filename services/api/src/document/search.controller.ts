import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MembershipGuard } from '../auth/membership.guard';
import { SearchService } from './search.service';
import { LibraryFeatureGuard } from './library-feature.guard';

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
  async search(@Req() req: Request, @Body() dto: SearchDto) {
    const userId = (req.user as any).userId;
    return this.searchService.similaritySearch(dto.query, userId, dto.topK);
  }
}
