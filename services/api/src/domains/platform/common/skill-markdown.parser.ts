import { HttpStatus } from '@nestjs/common';
import { load as parseYaml } from 'js-yaml';
import { I18nHttpException } from '../i18n/i18n-http.exception';

export interface ParsedSkillMarkdown {
  frontmatter: Record<string, unknown>;
  instructions: string;
  title?: string;
  description?: string;
  tags?: string[];
  modelHint?: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((it): it is string => typeof it === 'string' && !!it.trim());
}

export function parseSkillMarkdown(rawMarkdown: string): ParsedSkillMarkdown {
  const source = rawMarkdown.trim();
  if (!source) throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'platform.skill.content_empty');

  const match = source.match(FRONTMATTER_RE);
  let frontmatter: Record<string, unknown> = {};
  let instructions = source;

  if (match) {
    try {
      frontmatter = asRecord(parseYaml(match[1]) ?? {});
    } catch (error) {
      throw new I18nHttpException(
        HttpStatus.BAD_REQUEST,
        'platform.skill.frontmatter_parse_failed',
        { reason: (error as Error).message },
      );
    }
    instructions = source.slice(match[0].length).trim();
  }

  if (!instructions) {
    throw new I18nHttpException(HttpStatus.BAD_REQUEST, 'platform.skill.body_required');
  }

  return {
    frontmatter,
    instructions,
    title:
      typeof frontmatter.name === 'string'
        ? frontmatter.name
        : typeof frontmatter.title === 'string'
          ? frontmatter.title
          : undefined,
    description:
      typeof frontmatter.description === 'string'
        ? frontmatter.description
        : undefined,
    tags: stringList(frontmatter.tags),
    modelHint:
      typeof frontmatter.model === 'string'
        ? frontmatter.model
        : typeof frontmatter.defaultModel === 'string'
          ? frontmatter.defaultModel
          : undefined,
  };
}
