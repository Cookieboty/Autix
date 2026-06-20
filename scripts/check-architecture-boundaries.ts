import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

type BoundaryRule = {
  from: string;
  disallowed: RegExp[];
  message: string;
  include?: RegExp;
};

const root = process.cwd();
const sourceExtensions = new Set(['.ts', '.tsx']);
const ignoredParts = new Set(['node_modules', '.next', 'dist', 'out', 'coverage']);

const rules: BoundaryRule[] = [
  {
    from: 'clients',
    disallowed: [/from\s+['"]@autix\/shared-lib/],
    message: 'shared-lib has been removed; clients must use domain, sdk, platform, shared-store, or shared-ui',
  },
  {
    from: 'packages',
    disallowed: [/from\s+['"]@autix\/shared-lib/],
    message: 'shared-lib has been removed; packages must use domain, sdk, platform, shared-store, or shared-ui',
  },
  {
    from: 'services',
    disallowed: [/from\s+['"]@autix\/shared-lib/],
    message: 'shared-lib has been removed; services must use domain, database, or ai-adapters',
  },
  {
    from: 'packages/domain/src',
    disallowed: [
      /from\s+['"]@autix\/(shared-lib|shared-store|shared-ui|sdk|platform|database|ai-adapters)/,
      /from\s+['"](?:\.\.\/)+(?:clients|services)\//,
    ],
    message: 'domain must stay dependency-free from apps, services, sdk, platform, and UI packages',
  },
  {
    from: 'packages/shared-ui/src',
    disallowed: [
      /from\s+['"](?:\.\.\/)+(?:\.\.\/)+(?:services|clients)\//,
      /from\s+['"]@autix\/database/,
      /from\s+['"]@autix\/sdk/,
      /\b(?:window\.)?(?:localStorage|sessionStorage)\b/,
      /\b(?:authFetch|authFetchEventSource|getApiUrl)\b/,
    ],
    message: 'shared-ui cannot depend on services, clients, database, sdk, direct browser storage, or raw request helpers; use shared-store/platform adapters for runtime access',
  },
  {
    from: 'packages/shared-store/src',
    disallowed: [
      /from\s+['"](?:\.\.\/)+(?:\.\.\/)+(?:clients|services)\//,
      /from\s+['"]@autix\/(shared-ui|database)/,
      /\b(?:window\.)?(?:localStorage|sessionStorage)\b/,
    ],
    message: 'shared-store cannot depend on clients, services, shared-ui, database, or direct browser storage; use platform adapters',
  },
  {
    from: 'services/api/src',
    disallowed: [/from\s+['"]@autix\/(shared-ui|shared-store|sdk|platform)/],
    message: 'api service cannot depend on frontend runtime packages',
  },
  {
    from: 'packages/sdk/src',
    disallowed: [/\b(?:window\.)?(?:localStorage|sessionStorage)\b/],
    message: 'sdk cannot access browser storage directly; use platform storage adapters',
  },
  {
    from: 'clients',
    disallowed: [/from\s+['"](?:\.\.\/)+services\//, /from\s+['"]@autix\/database/],
    message: 'clients cannot depend on services/api or database',
  },
];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredParts.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...walk(path));
      continue;
    }
    const ext = path.slice(path.lastIndexOf('.'));
    if (sourceExtensions.has(ext)) files.push(path);
  }

  return files;
}

const violations: string[] = [];

function checkApiAppModuleImports() {
  const appModulePath = join(root, 'services/api/src/app.module.ts');
  let source = '';
  try {
    source = readFileSync(appModulePath, 'utf8');
  } catch {
    return;
  }

  const allowedRelativeImports = [
    './app.controller',
    './app.service',
    './i18n/i18n.middleware',
  ];
  const importPattern = /from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    const allowed =
      specifier.startsWith('@nestjs/') ||
      specifier.startsWith('./domains/') ||
      allowedRelativeImports.includes(specifier);
    if (!allowed) {
      violations.push(
        `services/api/src/app.module.ts: AppModule must import only domain aggregate modules and global bootstrap dependencies`,
      );
    }
  }
}

for (const rule of rules) {
  const absoluteFrom = join(root, rule.from);
  let files: string[] = [];
  try {
    files = walk(absoluteFrom);
  } catch {
    continue;
  }

  for (const file of files) {
    if (rule.include && !rule.include.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const pattern of rule.disallowed) {
      if (pattern.test(source)) {
        violations.push(`${relative(root, file)}: ${rule.message}`);
      }
    }
  }
}

checkApiAppModuleImports();

if (violations.length > 0) {
  console.error('Architecture boundary violations found:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Architecture boundary check passed.');
