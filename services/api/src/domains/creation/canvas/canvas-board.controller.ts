import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@autix/domain';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import {
  CurrentUser,
  getCurrentUserId,
} from '../../identity/auth/decorators/current-user.decorator';
import { CanvasBoardService } from './canvas-board.service';
import { CanvasActionService } from './canvas-action.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { SaveBoardStateDto } from './dto/save-board-state.dto';
import {
  ChatGenerateActionDto,
  EstimateActionDto,
  ImageGenerateActionDto,
} from './dto/run-canvas-action.dto';

@UseGuards(JwtAuthGuard)
@Controller('canvas-boards')
export class CanvasBoardController {
  constructor(
    private readonly boardService: CanvasBoardService,
    private readonly actionService: CanvasActionService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.boardService.listBoards(getCurrentUserId(user));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoardDto) {
    return this.boardService.createBoard(getCurrentUserId(user), dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.getBoard(getCurrentUserId(user), id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardService.updateBoard(getCurrentUserId(user), id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.deleteBoard(getCurrentUserId(user), id);
  }

  @Get(':id/state')
  getState(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.getState(getCurrentUserId(user), id);
  }

  @Put(':id/state')
  saveState(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SaveBoardStateDto,
    @Headers('if-match') ifMatch: string,
  ) {
    return this.boardService.saveState(getCurrentUserId(user), id, dto, ifMatch);
  }

  @Get(':id/versions')
  listVersions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.boardService.listVersions(getCurrentUserId(user), id);
  }

  @Post(':id/versions/:version/restore')
  restoreVersion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.boardService.restoreVersion(getCurrentUserId(user), id, version);
  }

  @Get(':id/actions')
  listActions(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('status') status?: string,
  ) {
    return this.actionService.listActions(getCurrentUserId(user), id, status);
  }

  @Post(':id/actions/estimate')
  estimate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EstimateActionDto,
  ) {
    return this.actionService.estimate(getCurrentUserId(user), id, dto);
  }

  @Post(':id/actions/image-generate')
  imageGenerate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ImageGenerateActionDto,
  ) {
    return this.actionService.imageGenerate(getCurrentUserId(user), id, dto);
  }

  @Post(':id/actions/chat-generate')
  chatGenerate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChatGenerateActionDto,
  ) {
    return this.actionService.chatGenerate(getCurrentUserId(user), id, dto);
  }
}
