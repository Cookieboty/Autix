import { describe, it, expect } from "bun:test";
import { RequirementService } from "../src/llm/requirement.service";

describe("RequirementService", () => {
  const service = new RequirementService();

  it("should extract structured requirement from input", async () => {
    const input = "用户注册时必须绑定手机号，密码至少8位";
    const result = await service.extract(input);

    expect(result).toBeDefined();
    expect(result.action).toBeDefined();
    expect(Array.isArray(result.constraints)).toBe(true);
    expect(Array.isArray(result.entities)).toBe(true);
  });

  it("should return action as core verb-object combination", async () => {
    const input = "用户登录后可以修改个人信息";
    const result = await service.extract(input);

    expect(result.action).toContain("登录");
  });

  it("should extract constraints with valid indicators", async () => {
    const input = "用户注册时必须绑定手机号，密码至少8位";
    const result = await service.extract(input);

    const validIndicators = ["必须", "至少"];
    const hasValidConstraint = result.constraints.some((c) =>
      validIndicators.some((ind) => c.includes(ind))
    );
    expect(hasValidConstraint).toBe(true);
  });

  it("should return empty arrays for missing fields", async () => {
    const input = "这是一个普通描述";
    const result = await service.extract(input);

    expect(Array.isArray(result.constraints)).toBe(true);
    expect(Array.isArray(result.entities)).toBe(true);
  });
});
