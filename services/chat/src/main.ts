import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 4001);
  console.log(`Chat service running on http://localhost:${process.env.PORT ?? 4001}`);
}
bootstrap();
