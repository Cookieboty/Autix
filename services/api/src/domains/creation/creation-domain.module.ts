import { Module } from '@nestjs/common';
import { ArenaModule } from '../../arena/arena.module';
import { ArtifactModule } from '../../artifact/artifact.module';
import { ConversationModule } from '../../conversation/conversation.module';
import { DocumentModule } from '../../document/document.module';
import { ImageGenModule } from '../../image-gen/image-gen.module';
import { LlmModule } from '../../llm/llm.module';
import { MaterialsModule } from '../../materials/materials.module';
import { MessageModule } from '../../message/message.module';
import { ModelConfigModule } from '../../model-config/model-config.module';
import { VideoModule } from '../../video/video.module';

@Module({
  imports: [
    ConversationModule,
    MessageModule,
    LlmModule,
    ArtifactModule,
    ArenaModule,
    DocumentModule,
    ImageGenModule,
    VideoModule,
    MaterialsModule,
    ModelConfigModule,
  ],
  exports: [
    ConversationModule,
    MessageModule,
    LlmModule,
    ArtifactModule,
    ArenaModule,
    DocumentModule,
    ImageGenModule,
    VideoModule,
    MaterialsModule,
    ModelConfigModule,
  ],
})
export class CreationDomainModule {}
