import { Controller, Get, Post, Body } from "@nestjs/common";
import { AppService } from "./app.service";
import { RequirementService } from "./llm/requirement.service";
import { RequirementResult } from "@repo/contracts";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly requirementService: RequirementService,
  ) {}

  @Get("health")
  getHealth() {
    return this.appService.getHealth();
  }

  @Get("hello")
  getHello() {
    return this.appService.getHello();
  }

  @Post("requirement/extract")
  async extractRequirement(@Body() body: { input: string }): Promise<{ result: RequirementResult }> {
    const result = await this.requirementService.extract(body.input);
    return { result };
  }
}
