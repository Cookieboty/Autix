export function composeTemplatePrompt(
  prompt: string,
  values: Record<string, string>,
): string {
  return prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined || value === null ? match : value;
  });
}
