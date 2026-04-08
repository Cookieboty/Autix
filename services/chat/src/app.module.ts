import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { LlmModule } from "./llm/llm.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [PrismaModule, LlmModule, AuthModule],
})
export class AppModule {}
