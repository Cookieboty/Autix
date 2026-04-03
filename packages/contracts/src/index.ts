import { z } from "zod";

export const APP_NAME = "llm";

// Summary request schema
export const SummaryRequestSchema = z.object({
  input: z.string(),
});

export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;

// Summary result schema
export const SummaryResultSchema = z.object({
  summary: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  keywords: z.array(z.string()),
});

export type SummaryResult = z.infer<typeof SummaryResultSchema>;

// Requirement schema
export const RequirementSchema = z.object({
  input: z.string(),
});

export type Requirement = z.infer<typeof RequirementSchema>;

// Requirement result schema
export const RequirementResultSchema = z.object({
  action: z.string().describe('唯一核心动作'),
  constraints: z.array(z.string()).describe('明确约束条件'),
  entities: z.array(z.string()).describe('关键实体'),
});

export type RequirementResult = z.infer<typeof RequirementResultSchema>;
