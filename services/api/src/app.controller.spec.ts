import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it("should return health ok", () => {
    expect(controller.getHealth()).toEqual({ ok: true });
  });

  it("should return hello message with APP_NAME", () => {
    const result = controller.getHello();
    expect(result.message).toContain("Hello from API");
    expect(result.message).toContain("llm");
  });
});
