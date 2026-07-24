export interface ValidationSchema {
  requiredSections?: string[];
  jsonSchema?: Record<string, unknown>;
  codeCheck?: 'typecheck' | 'parse';
}

export interface ValidationResult {
  passed: boolean;
  reasons: string[];
}

/**
 * Schema 校验（必跑）：根据 step 定义的 validationSchema 做结构化检查。
 */
export function validateStepArtifact(
  content: string,
  schema: ValidationSchema | null | undefined,
): ValidationResult {
  if (!schema) return { passed: true, reasons: [] };

  const reasons: string[] = [];

  // 必备章节检查（PRD 必有"功能需求"、技术文档必有"数据模型"等）
  if (schema.requiredSections) {
    for (const section of schema.requiredSections) {
      if (!content.includes(section)) {
        reasons.push(`Missing required section: "${section}"`);
      }
    }
  }

  // JSON schema 校验（如果产物应是 JSON）
  if (schema.jsonSchema) {
    try {
      JSON.parse(content);
    } catch {
      reasons.push('Output content is not valid JSON');
    }
  }

  // 代码检查（简单的语法验证）
  if (schema.codeCheck === 'parse') {
    try {
      new Function(content);
    } catch (err) {
      reasons.push(`Code syntax error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
