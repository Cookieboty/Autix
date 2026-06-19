import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

type BoundaryRule = {
  from: string;
  disallowed: RegExp[];
  message: string;
};

const root = process.cwd();
const sourceExtensions = new Set(['.ts', '.tsx']);
const ignoredParts = new Set(['node_modules', '.next', 'dist', 'out', 'coverage']);

const rules: BoundaryRule[] = [
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
    ],
    message: 'shared-ui cannot depend on services, clients, or database',
  },
  {
    from: 'packages/shared-store/src',
    disallowed: [
      /from\s+['"](?:\.\.\/)+(?:\.\.\/)+(?:clients|services)\//,
      /from\s+['"]@autix\/(shared-ui|database)/,
    ],
    message: 'shared-store cannot depend on clients, services, shared-ui, or database',
  },
  {
    from: 'services/api/src',
    disallowed: [/from\s+['"]@autix\/(shared-ui|shared-store|sdk|platform)/],
    message: 'api service cannot depend on frontend runtime packages',
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

for (const rule of rules) {
  const absoluteFrom = join(root, rule.from);
  let files: string[] = [];
  try {
    files = walk(absoluteFrom);
  } catch {
    continue;
  }

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of rule.disallowed) {
      if (pattern.test(source)) {
        violations.push(`${relative(root, file)}: ${rule.message}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary violations found:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Architecture boundary check passed.');
