import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../identity/auth/decorators/public.decorator';
import { FeaturedSlotsService } from './featured-slots.service';

/** 前台只读接口：按 placement 取当前应展示的运营位（已 resolveSlot）。 */
@Controller('featured-slots')
export class FeaturedSlotsController {
  constructor(private readonly service: FeaturedSlotsService) {}

  @Public()
  @Get()
  getByPlacement(@Query('placement') placement: string) {
    return this.service.getResolvedByPlacement(placement);
  }
}
