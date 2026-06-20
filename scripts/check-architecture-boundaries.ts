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
    from: 'clients',
    disallowed: [/\bPlan-\d+\b/],
    message: 'stale implementation plan labels are not allowed in product code; use descriptive comments instead',
  },
  {
    from: 'packages',
    disallowed: [/from\s+['"]@autix\/shared-lib/],
    message: 'shared-lib has been removed; packages must use domain, sdk, platform, shared-store, or shared-ui',
  },
  {
    from: 'packages',
    disallowed: [/\bPlan-\d+\b/],
    message: 'stale implementation plan labels are not allowed in package code; use descriptive comments instead',
  },
  {
    from: 'services',
    disallowed: [/from\s+['"]@autix\/shared-lib/],
    message: 'shared-lib has been removed; services must use domain, database, or ai-adapters',
  },
  {
    from: 'services/api/src',
    disallowed: [/\bPlan-\d+\b/],
    message: 'stale implementation plan labels are not allowed in API code; use descriptive comments instead',
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
  {
    from: 'clients',
    disallowed: [/from\s+['"]@autix\/sdk/, /import\s*\(\s*['"]@autix\/sdk/],
    message: 'clients must use shared-store/controller hooks instead of SDK directly',
  },
  {
    from: 'clients',
    include: /\/(admin|system)\//,
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'admin/system pages must use shared-store hooks, not SDK directly',
  },
  {
    from: 'clients',
    include: /\/(?:activate|forgot-password|login|membership|models|pending|register|reset-password)(?:\/|\.|$)/,
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'migrated auth, membership, and models pages must use shared-store hooks, not SDK directly',
  },
  {
    from: 'packages/shared-store/src',
    include: /\.queries\.ts$/,
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'queries files should only import from actions layer, not SDK directly',
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

const apiDomainModules: Record<string, string[]> = {
  admin: ['admin'],
  billing: ['campaign', 'invite', 'membership', 'order', 'points'],
  creation: [
    'arena',
    'artifact',
    'conversation',
    'document',
    'image-gen',
    'llm',
    'materials',
    'message',
    'model-config',
    'risk',
    'video',
  ],
  identity: [
    'auth',
    'bootstrap',
    'menu',
    'permission',
    'permission-tree',
    'registration',
    'role',
    'session',
    'system',
    'user',
  ],
  marketplace: [
    'acquisitions',
    'agents',
    'image-templates',
    'marketplace',
    'mcp',
    'skills',
    'video-templates',
  ],
  platform: [
    'amux-proxy',
    'common',
    'i18n',
    'mail',
    'prisma',
    'sse',
    'storage',
    'system-settings',
  ],
};

const prismaControllerMigrationExceptions = new Set<string>();

const apiRepositoryOnlyPrismaDirectories = [
  'services/api/src/domains/creation/conversation',
  'services/api/src/domains/creation/model-config',
  'services/api/src/domains/platform/system-settings',
];

const apiFinalTopLevelFiles = new Set([
  'app.controller.ts',
  'app.module.ts',
  'app.service.ts',
  'main.ts',
]);

const apiFinalTopLevelDirectories = new Set(['domains']);

function getApiDomainModuleImportTarget(specifier: string):
  | { moduleName: string; layout: 'domain-local' | 'legacy-top-level' }
  | null {
  const domainLocalMatch = specifier.match(/^\.\/([^/]+)\/[^/]+\.module(?:\.ts)?$/);
  if (domainLocalMatch) {
    return { moduleName: domainLocalMatch[1], layout: 'domain-local' };
  }

  const legacyTopLevelMatch = specifier.match(/^\.\.\/\.\.\/([^/]+)\/[^/]+\.module(?:\.ts)?$/);
  if (legacyTopLevelMatch) {
    return { moduleName: legacyTopLevelMatch[1], layout: 'legacy-top-level' };
  }

  return null;
}

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
      specifier.startsWith('./config/') ||
      specifier.startsWith('./bootstrap/') ||
      allowedRelativeImports.includes(specifier);
    if (!allowed) {
      violations.push(
        `services/api/src/app.module.ts: AppModule must import only domain aggregate modules and global bootstrap dependencies`,
      );
    }
  }
}

function checkApiDomainModuleImports() {
  const domainsRoot = join(root, 'services/api/src/domains');
  for (const [domain, allowedModules] of Object.entries(apiDomainModules)) {
    const domainModulePath = join(domainsRoot, domain, `${domain}-domain.module.ts`);
    let source = '';
    try {
      source = readFileSync(domainModulePath, 'utf8');
    } catch {
      violations.push(`services/api/src/domains/${domain}: missing ${domain}-domain.module.ts`);
      continue;
    }

    const importPattern = /from\s+['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (specifier === '@nestjs/common') continue;

      const target = getApiDomainModuleImportTarget(specifier);
      if (!target || !allowedModules.includes(target.moduleName)) {
        violations.push(
          `${relative(root, domainModulePath)}: ${domain} domain aggregate imports an undeclared module (${specifier})`,
        );
        continue;
      }

      if (target.layout === 'legacy-top-level') {
        violations.push(
          `${relative(root, domainModulePath)}: ${domain} domain aggregate must import physicalized modules from ./<module>/<module>.module (${specifier})`,
        );
      }
    }
  }
}

function checkApiFinalTopLevelLayout() {
  const apiSrc = join(root, 'services/api/src');
  let entries: string[] = [];
  try {
    entries = readdirSync(apiSrc);
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(apiSrc, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (!apiFinalTopLevelDirectories.has(entry)) {
        violations.push(
          `services/api/src/${entry}: API domain physicalization is complete; move top-level business directories under services/api/src/domains`,
        );
      }
      continue;
    }

    if (stat.isFile() && !apiFinalTopLevelFiles.has(entry)) {
      violations.push(
        `services/api/src/${entry}: API domain physicalization is complete; only app.controller/app.service/app.module/main may remain at the API src root`,
      );
    }
  }
}

function checkApiControllerPrismaUsage() {
  const apiSrc = join(root, 'services/api/src');
  let files: string[] = [];
  try {
    files = walk(apiSrc).filter((file) => file.endsWith('.controller.ts'));
  } catch {
    return;
  }

  for (const file of files) {
    const relativePath = relative(root, file);
    if (prismaControllerMigrationExceptions.has(relativePath)) continue;

    const source = readFileSync(file, 'utf8');
    if (/\bPrismaService\b/.test(source)) {
      violations.push(
        `${relativePath}: controllers must not inject PrismaService directly; move queries into an application service`,
      );
    }
  }
}

function checkApiRepositoryOnlyPrismaUsage() {
  for (const directory of apiRepositoryOnlyPrismaDirectories) {
    const absoluteDirectory = join(root, directory);
    let files: string[] = [];
    try {
      files = walk(absoluteDirectory);
    } catch {
      continue;
    }

    for (const file of files) {
      const relativePath = relative(root, file);
      if (file.endsWith('.spec.ts') || file.endsWith('.repository.ts')) continue;

      const source = readFileSync(file, 'utf8');
      if (/\bPrismaService\b|this\.prisma\b/.test(source)) {
        violations.push(
          `${relativePath}: Prisma access for this domain must stay inside repository files`,
        );
      }
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
checkApiDomainModuleImports();
checkApiFinalTopLevelLayout();
checkApiControllerPrismaUsage();
checkApiRepositoryOnlyPrismaUsage();

if (violations.length > 0) {
  console.error('Architecture boundary violations found:\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('Architecture boundary check passed.');
