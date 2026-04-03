import { Module } from "@nestjs/common";
import { LlmService } from "./llm.service";
import { LlmController } from "./llm.controller";
import { RequirementService } from "./requirement.service";

@Module({
  providers: [LlmService, RequirementService],
  controllers: [LlmController],
  exports: [LlmService, RequirementService],
})
export class LlmModule {}
