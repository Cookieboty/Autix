import { Module } from '@nestjs/common';
import { ArtifactModule } from './artifact/artifact.module';
import { CanvasModule } from './canvas/canvas.module';
import { ConversationModule } from './conversation/conversation.module';
import { DocumentModule } from './document/document.module';
import { GalleryModule } from './gallery/gallery.module';
import { ImageGenModule } from './image-gen/image-gen.module';
import { LlmModule } from './llm/llm.module';
import { MaterialsModule } from './materials/materials.module';
import { MessageModule } from './message/message.module';
import { ModelConfigModule } from './model-config/model-config.module';
import { PublicProfileModule } from './profile/public-profile.module';
import { RiskModule } from './risk/risk.module';
import { VideoModule } from './video/video.module';

@Module({
  imports: [
    ConversationModule,
    MessageModule,
    LlmModule,
    ArtifactModule,
    DocumentModule,
    CanvasModule,
    GalleryModule,
    ImageGenModule,
    VideoModule,
    MaterialsModule,
    ModelConfigModule,
    PublicProfileModule,
    RiskModule,
  ],
  exports: [
    ConversationModule,
    MessageModule,
    LlmModule,
    ArtifactModule,
    DocumentModule,
    CanvasModule,
    GalleryModule,
    ImageGenModule,
    VideoModule,
    MaterialsModule,
    ModelConfigModule,
    RiskModule,
  ],
})
export class CreationDomainModule {}
