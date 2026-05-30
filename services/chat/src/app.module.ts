import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { LlmModule } from './llm/llm.module';
import { MessageModule } from './message/message.module';
import { ConversationModule } from './conversation/conversation.module';
import { DocumentModule } from './document/document.module';
import { SseModule } from './sse/sse.module';
import { ModelConfigModule } from './model-config/model-config.module';
import { ArtifactModule } from './artifact/artifact.module';
import { ArenaModule } from './arena/arena.module';
import { ImageTemplatesModule } from './image-templates/image-templates.module';
import { VideoTemplatesModule } from './video-templates/video-templates.module';
// 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
// import { SkillsModule } from './skills/skills.module';
// import { McpModule } from './mcp/mcp.module';
import { AgentsModule } from './agents/agents.module';
import { AcquisitionsModule } from './acquisitions/acquisitions.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { CommonModule } from './common/common.module';
import { ImageGenModule } from './image-gen/image-gen.module';
import { StorageModule } from './storage/storage.module';
import { MembershipModule } from './membership/membership.module';
import { PointsModule } from './points/points.module';
import { OrderModule } from './order/order.module';
import { InviteModule } from './invite/invite.module';
import { AdminModule } from './admin/admin.module';
import { AmuxProxyModule } from './amux-proxy/amux-proxy.module';
import { VideoModule } from './video/video.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { I18nModule } from './i18n/i18n.module';
import { I18nMiddleware } from './i18n/i18n.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    I18nModule,
    PrismaModule,
    AuthModule,
    LlmModule,
    MessageModule,
    ConversationModule,
    DocumentModule,
    SseModule,
    ModelConfigModule,
    ArtifactModule,
    ArenaModule,
    CommonModule,
    ImageTemplatesModule,
    VideoTemplatesModule,
    // 暂时移除 mcp、skills 模板，专注图片与视频的 agents 开发
    // SkillsModule,
    // McpModule,
    AgentsModule,
    AcquisitionsModule,
    MarketplaceModule,
    ImageGenModule,
    StorageModule,
    MembershipModule,
    PointsModule,
    OrderModule,
    AdminModule,
    InviteModule,
    AmuxProxyModule,
    VideoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(I18nMiddleware).forRoutes('*');
  }
}
