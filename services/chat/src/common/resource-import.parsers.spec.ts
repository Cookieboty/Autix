import { McpTransport } from '@prisma/client';
import { normalizeMcpConfig } from './mcp-config.parser';
import { parseSkillMarkdown } from './skill-markdown.parser';
import { RuntimeDetectorService } from './runtime-detector.service';

describe('resource import parsers', () => {
  it('normalizes MCP mcpServers config and sanitizes secrets', () => {
    const normalized = normalizeMcpConfig({
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_real_secret' },
        },
      },
    });

    expect(normalized.serverName).toBe('github');
    expect(normalized.transport).toBe(McpTransport.stdio);
    expect(normalized.envSchema?.GITHUB_PERSONAL_ACCESS_TOKEN).toMatchObject({
      required: true,
      placeholder: '${GITHUB_PERSONAL_ACCESS_TOKEN}',
    });
    const rawServers = normalized.rawConfig.mcpServers as Record<string, unknown>;
    const rawGithub = rawServers.github as { env: Record<string, string> };
    expect(rawGithub.env.GITHUB_PERSONAL_ACCESS_TOKEN).toBe(
      '${GITHUB_PERSONAL_ACCESS_TOKEN}',
    );
  });

  it('parses SKILL.md frontmatter and body', () => {
    const parsed = parseSkillMarkdown(`---
name: Code Review Expert
description: Review PR diffs
model: gpt-5
tags:
  - code-review
---

# Instructions

Review code carefully.`);

    expect(parsed.title).toBe('Code Review Expert');
    expect(parsed.modelHint).toBe('gpt-5');
    expect(parsed.tags).toEqual(['code-review']);
    expect(parsed.instructions).toContain('Review code carefully.');
  });

  it('detects stdio MCP as desktop only', () => {
    const detector = new RuntimeDetectorService({} as never);
    const result = detector.detectMcp({
      transport: McpTransport.stdio,
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem'],
    });

    expect(result.level).toBe('DESKTOP_ONLY');
  });
});
