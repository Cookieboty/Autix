import { Module, forwardRef } from '@nestjs/common';
import { ArtifactController } from './artifact.controller';
import { ArtifactService } from './artifact.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConversationModule } from '../conversation/conversation.module';
import { LlmModule } from '../llm/llm.module';
import { ModelConfigModule } from '../model-config/model-config.module';

@Module({
  imports: [PrismaModule, forwardRef(() => ConversationModule), LlmModule, ModelConfigModule],
  controllers: [ArtifactController],
  providers: [ArtifactService],
  exports: [ArtifactService],
})
export class ArtifactModule {}
