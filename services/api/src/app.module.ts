import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { LlmModule } from "./llm/llm.module";

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [LlmModule],
})
export class AppModule {}
