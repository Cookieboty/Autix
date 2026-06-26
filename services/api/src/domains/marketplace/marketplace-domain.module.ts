import { Module } from '@nestjs/common';
import { AcquisitionsModule } from './acquisitions/acquisitions.module';
import { AgentsModule } from './agents/agents.module';
import { ImageTemplatesModule } from './image-templates/image-templates.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { McpModule } from './mcp/mcp.module';
import { PublicGrowthModule } from './public-growth/public-growth.module';
import { SkillsModule } from './skills/skills.module';
import { VideoTemplatesModule } from './video-templates/video-templates.module';

@Module({
  imports: [
    MarketplaceModule,
    AcquisitionsModule,
    AgentsModule,
    SkillsModule,
    McpModule,
    ImageTemplatesModule,
    VideoTemplatesModule,
    PublicGrowthModule,
  ],
  exports: [
    MarketplaceModule,
    AcquisitionsModule,
    AgentsModule,
    SkillsModule,
    McpModule,
    ImageTemplatesModule,
    VideoTemplatesModule,
    PublicGrowthModule,
  ],
})
export class MarketplaceDomainModule {}
