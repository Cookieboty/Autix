import { z } from "zod";
import { tool } from "@langchain/core/tools";

/**
 * Tool: check_constraint_validity
 * 验证约束条件是否合理
 */
export const checkConstraintValidityTool = tool(
  async (input: { constraint: string; context: string }) => {
    // 模拟验证逻辑
    const validIndicators = ["必须", "至少", "不得", "不能", "应该"];
    const isValid = validIndicators.some((indicator) =>
      input.constraint.includes(indicator)
    );
    return {
      valid: isValid,
      constraint: input.constraint,
      reason: isValid ? "约束条件符合规范" : "约束条件格式不规范",
    };
  },
  {
    name: "check_constraint_validity",
    description: "检查约束条件的有效性，输入约束内容和上下文",
    schema: z.object({
      constraint: z.string().describe("约束条件文本"),
      context: z.string().describe("需求上下文"),
    }),
  }
);

/**
 * Tool: lookup_entity_definition
 * 查找实体定义
 */
export const lookupEntityDefinitionTool = tool(
  async (input: { entity: string }) => {
    // 模拟实体定义库
    const entityDefinitions: Record<string, string> = {
      手机号: "用户绑定的11位数字，用于接收验证码",
      密码: "用户用于登录的凭证，至少8位",
      用户: "系统的使用者，可以注册和登录",
      Excel: "微软表格文件格式，用于导入导出数据",
      日报: "每日工作报告，包含当日工作内容",
    };

    const definition = entityDefinitions[input.entity] || "未找到定义";
    return {
      entity: input.entity,
      definition,
    };
  },
  {
    name: "lookup_entity_definition",
    description: "查询实体的定义，输入实体名称",
    schema: z.object({
      entity: z.string().describe("实体名称"),
    }),
  }
);

/**
 * 导出所有工具
 */
export const basicTools = [checkConstraintValidityTool, lookupEntityDefinitionTool];
