import { Module, forwardRef } from '@nestjs/common';
import { ArtifactController } from './artifact.controller';
import { ArtifactService } from './artifact.service';
import { PrismaModule } from '../../platform/prisma/prisma.module';
import { ConversationModule } from '../conversation/conversation.module';
import { LlmModule } from '../llm/llm.module';
import { ModelConfigModule } from '../model-config/model-config.module';
import { ArtifactRepository } from './artifact.repository';

@Module({
  imports: [PrismaModule, forwardRef(() => ConversationModule), LlmModule, ModelConfigModule],
  controllers: [ArtifactController],
  providers: [ArtifactService, ArtifactRepository],
  exports: [ArtifactService],
})
export class ArtifactModule {}
