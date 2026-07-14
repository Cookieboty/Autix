import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

type BoundaryRule = {
  from: string;
  disallowed: RegExp[];
  message: string;
  include?: RegExp;
  exclude?: RegExp;
  stripComments?: boolean;
};

const root = process.cwd();
const sourceExtensions = new Set(['.ts', '.tsx']);
const sourceLikeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const ignoredParts = new Set(['node_modules', '.next', 'dist', 'out', 'coverage', '.turbo']);
const sharedLibImportPattern =
  /(?:from\s+['"]@autix\/shared-lib(?:\/[^'"]*)?['"]|import\s+['"]@autix\/shared-lib(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@autix\/shared-lib(?:\/[^'"]*)?['"]\s*\)|require\s*\(\s*['"]@autix\/shared-lib(?:\/[^'"]*)?['"]\s*\))/;
const typesImportPattern =
  /(?:from\s+['"]@autix\/types(?:\/[^'"]*)?['"]|import\s+['"]@autix\/types(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@autix\/types(?:\/[^'"]*)?['"]\s*\)|require\s*\(\s*['"]@autix\/types(?:\/[^'"]*)?['"]\s*\))/;
const apiServiceImportPattern =
  /(?:from\s+['"](?:@autix\/api(?:\/[^'"]*)?|(?:\.\.\/)+services\/api(?:\/[^'"]*)?)['"]|import\s+['"](?:@autix\/api(?:\/[^'"]*)?|(?:\.\.\/)+services\/api(?:\/[^'"]*)?)['"]|import\s*\(\s*['"](?:@autix\/api(?:\/[^'"]*)?|(?:\.\.\/)+services\/api(?:\/[^'"]*)?)['"]\s*\)|require\s*\(\s*['"](?:@autix\/api(?:\/[^'"]*)?|(?:\.\.\/)+services\/api(?:\/[^'"]*)?)['"]\s*\))/;
const databaseImportPattern =
  /(?:from\s+['"]@autix\/database(?:\/[^'"]*)?['"]|import\s+['"]@autix\/database(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@autix\/database(?:\/[^'"]*)?['"]\s*\)|require\s*\(\s*['"]@autix\/database(?:\/[^'"]*)?['"]\s*\))/;
const axiosImportPattern =
  /(?:from\s+['"]axios(?:\/[^'"]*)?['"]|import\s+['"]axios(?:\/[^'"]*)?['"]|import\s*\(\s*['"]axios(?:\/[^'"]*)?['"]\s*\)|require\s*\(\s*['"]axios(?:\/[^'"]*)?['"]\s*\))/;

const rules: BoundaryRule[] = [
  {
    from: 'clients',
    disallowed: [sharedLibImportPattern],
    message: 'shared-lib has been removed; clients must use domain, sdk, platform, shared-store, or shared-ui',
  },
  {
    from: 'clients',
    disallowed: [/\bPlan-\d+\b/],
    message: 'stale implementation plan labels are not allowed in product code; use descriptive comments instead',
  },
  {
    from: 'packages',
    disallowed: [sharedLibImportPattern],
    message: 'shared-lib has been removed; packages must use domain, sdk, platform, shared-store, or shared-ui',
  },
  {
    from: 'packages',
    disallowed: [/\bPlan-\d+\b/],
    message: 'stale implementation plan labels are not allowed in package code; use descriptive comments instead',
  },
  {
    from: 'services',
    disallowed: [sharedLibImportPattern],
    message: 'shared-lib has been removed; services must use domain, database, or ai-adapters',
  },
  {
    from: 'clients',
    disallowed: [typesImportPattern],
    message: '@autix/types has been removed; import shared contracts from @autix/domain',
  },
  {
    from: 'packages',
    disallowed: [typesImportPattern],
    message: '@autix/types has been removed; import shared contracts from @autix/domain',
  },
  {
    from: 'services',
    disallowed: [typesImportPattern],
    message: '@autix/types has been removed; import shared contracts from @autix/domain',
  },
  {
    from: 'services/api/src',
    disallowed: [/\bPlan-\d+\b/],
    message: 'stale implementation plan labels are not allowed in API code; use descriptive comments instead',
  },
  {
    from: 'packages/domain/src',
    disallowed: [
      sharedLibImportPattern,
      apiServiceImportPattern,
      databaseImportPattern,
      /from\s+['"]@autix\/(shared-store|shared-ui|sdk|platform|ai-adapters)/,
      /from\s+['"](?:\.\.\/)+(?:clients|services)\//,
    ],
    message: 'domain must stay dependency-free from apps, services, api, database, sdk, platform, and UI packages',
  },
  {
    from: 'packages/shared-ui/src',
    stripComments: true,
    disallowed: [
      apiServiceImportPattern,
      /from\s+['"](?:\.\.\/)+(?:services|clients)\//,
      databaseImportPattern,
      /from\s+['"]@autix\/sdk/,
      axiosImportPattern,
      /\b(?:window\.)?(?:localStorage|sessionStorage|indexedDB)\b/,
      /(?:^|[^\w-])(?:window\.)?fetch\s*\(/,
      /\bnew\s+(?:XMLHttpRequest|EventSource|WebSocket)\s*\(/,
      /\b(?:authFetch|authFetchEventSource|getApiUrl|getApiBaseUrl|storageApi|uploadToPresignedUrl)\b/,
    ],
    message: 'shared-ui cannot depend on services/api, clients, database, sdk, direct browser storage, axios/fetch/WebSocket APIs, or raw request helpers; use shared-store/platform adapters for runtime access',
  },
  {
    from: 'packages/shared-ui/src',
    exclude: /^packages\/shared-ui\/src\/hooks\/useIsElectron\.ts$/,
    stripComments: true,
    disallowed: [
      /from\s+['"]electron(?:\/[^'"]*)?['"]/,
      /require\s*\(\s*['"]electron(?:\/[^'"]*)?['"]\s*\)/,
      /\bwindow\.electron\b/,
      /\bwindow\.amux\b/,
      /\bprocess\.versions\.electron\b/,
      /\bnavigator\.userAgent\b/,
    ],
    message: 'shared-ui must detect Electron only through hooks/useIsElectron; keep runtime probing in platform adapters or that hook',
  },
  {
    from: 'packages/shared-store/src',
    disallowed: [
      apiServiceImportPattern,
      /from\s+['"](?:\.\.\/)+(?:clients|services)\//,
      databaseImportPattern,
      /from\s+['"]@autix\/shared-ui/,
      /\b(?:window\.)?(?:localStorage|sessionStorage)\b/,
    ],
    message: 'shared-store cannot depend on clients, services/api, shared-ui, database, or direct browser storage; use platform adapters',
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
    disallowed: [apiServiceImportPattern, /from\s+['"](?:\.\.\/)+services\//, databaseImportPattern],
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

function walkAll(dir: string): string[] {
  const entries = readdirSync(dir);
  const paths: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    paths.push(path);
    const stat = statSync(path);
    if (stat.isDirectory()) paths.push(...walkAll(path));
  }

  return paths;
}

function stripComments(source: string): string {
  let output = '';
  let index = 0;
  let quote: "'" | '"' | '`' | null = null;

  while (index < source.length) {
    const current = source[index];
    const next = source[index + 1];

    if (quote) {
      output += current;
      if (current === '\\') {
        if (next) output += next;
        index += 2;
        continue;
      }
      if (current === quote) quote = null;
      index += 1;
      continue;
    }

    if (current === "'" || current === '"' || current === '`') {
      quote = current;
      output += current;
      index += 1;
      continue;
    }

    if (current === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }

    if (current === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') output += '\n';
        index += 1;
      }
      index += 2;
      continue;
    }

    output += current;
    index += 1;
  }

  return output;
}

const violations: string[] = [];

const apiDomainModules: Record<string, string[]> = {
  admin: ['admin'],
  billing: ['campaign', 'invite', 'membership', 'order', 'points'],
  creation: [
    'arena',
    'artifact',
    'canvas',
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
    'risk',
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
    'public-growth',
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
  'services/api/src/domains/admin/admin',
  'services/api/src/domains/billing',
  'services/api/src/domains/creation',
  'services/api/src/domains/identity',
  'services/api/src/domains/marketplace',
  'services/api/src/domains/platform/amux-proxy',
  'services/api/src/domains/platform/common',
  'services/api/src/domains/platform/sse',
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

function checkSharedLibIsNotRevived() {
  const sharedLibRoot = join(root, 'packages/shared-lib');
  let entries: string[] = [];
  try {
    entries = readdirSync(sharedLibRoot);
  } catch {
    return;
  }

  const allowedGeneratedDirectories = new Set(['dist', 'node_modules', '.turbo']);

  for (const entry of entries) {
    const path = join(sharedLibRoot, entry);
    const stat = statSync(path);

    if (stat.isFile()) {
      violations.push(
        `packages/shared-lib/${entry}: shared-lib has been removed; do not recreate a package root here`,
      );
      continue;
    }

    if (!stat.isDirectory()) continue;
    if (allowedGeneratedDirectories.has(entry)) continue;

    const nestedPaths = walkAll(path);
    const hasSourceLikeFile = nestedPaths.some((nestedPath) => {
      const nestedStat = statSync(nestedPath);
      if (!nestedStat.isFile()) return false;
      const extension = nestedPath.slice(nestedPath.lastIndexOf('.'));
      return sourceLikeExtensions.has(extension);
    });
    const hasPackageManifest = nestedPaths.some(
      (nestedPath) => relative(path, nestedPath) === 'package.json',
    );

    if (hasSourceLikeFile || hasPackageManifest) {
      violations.push(
        `packages/shared-lib/${entry}: shared-lib source/package resurrection is blocked; migrate code to domain, sdk, platform, shared-store, or shared-ui`,
      );
    }
  }
}

function checkTypesIsNotRevived() {
  const typesRoot = join(root, 'packages/types');
  let entries: string[] = [];
  try {
    entries = readdirSync(typesRoot);
  } catch {
    return;
  }

  const allowedGeneratedDirectories = new Set(['dist', 'node_modules', '.turbo']);

  for (const entry of entries) {
    const path = join(typesRoot, entry);
    const stat = statSync(path);

    if (stat.isFile()) {
      violations.push(
        `packages/types/${entry}: @autix/types has been removed; do not recreate a package root here`,
      );
      continue;
    }

    if (!stat.isDirectory()) continue;
    if (allowedGeneratedDirectories.has(entry)) continue;

    const nestedPaths = walkAll(path);
    const hasSourceLikeFile = nestedPaths.some((nestedPath) => {
      const nestedStat = statSync(nestedPath);
      if (!nestedStat.isFile()) return false;
      const extension = nestedPath.slice(nestedPath.lastIndexOf('.'));
      return sourceLikeExtensions.has(extension);
    });
    const hasPackageManifest = nestedPaths.some(
      (nestedPath) => relative(path, nestedPath) === 'package.json',
    );

    if (hasSourceLikeFile || hasPackageManifest) {
      violations.push(
        `packages/types/${entry}: @autix/types source/package resurrection is blocked; migrate code to @autix/domain`,
      );
    }
  }
}

export function countGrowthViolations(src: string): { color: number; inlineZh: number } {
  const patterns: RegExp[] = [
    // 命名色板 + 可选透明度/深浅(bg-zinc-900 / text-white/60 / bg-white/[0.045])
    /(?:bg|text|border|from|via|to|ring|fill|stroke|shadow|outline|decoration|caret|accent|ring-offset)-(?:zinc|neutral|slate|gray|white|black|lime|emerald|green|red|rose|blue|sky|cyan|amber|yellow|purple|violet|fuchsia|pink|indigo|teal|orange)(?:\/(?:\d+|\[[0-9.]+\]))?(?:-\d{2,3})?/g,
    // 任意值方括号(color-bearing utility 不该用 -[...]):bg-[#..]/bg-[linear-gradient..]/text-[oklch..]
    // Only matches brackets whose content contains a color signal; size/spacing arbitraries like text-[10px] are excluded
    /(?:bg|text|border|from|via|to|ring|fill|stroke|shadow|outline|decoration|caret|accent|ring-offset)-\[[^\]]*(?:#|rgba?\(|oklch\(|hsla?\(|gradient|color-mix)[^\]]*\]/g,
    /#[0-9a-fA-F]{3,8}\b/g,        // 裸 hex
    /rgba?\([^)]*\)/g,             // rgb()/rgba()
    /\boklch\([^)]*\)|\bhsl[a]?\([^)]*\)/g, // oklch()/hsl()
    /color-mix\(/g,                // bare color-mix() in inline styles / style props
  ];
  const color = patterns.reduce((n, re) => n + (src.match(re)?.length ?? 0), 0);
  // 兼容 locale.toLowerCase().startsWith('zh') 与 locale.startsWith("zh")
  const inlineZh = src.match(/\.startsWith\(\s*['"]zh['"]/g)?.length ?? 0;
  return { color, inlineZh };
}

/**
 * Files governed by the growth-ratchet guardrail.
 * - RATCHET_GOVERNED_DIRS: all non-test files under these directories are scanned.
 * - RATCHET_GOVERNED_EXTRA_FILES: individual files added to governance outside the dirs above.
 * Add entries here to extend coverage.
 */
export const RATCHET_GOVERNED_DIRS = [
  'packages/shared-ui/src/growth',
];
export const RATCHET_GOVERNED_EXTRA_FILES: string[] = [];

export type RatchetCounts = { color: number; inlineZh: number };

/**
 * Pure helper: evaluate ratchet totals against a baseline.
 * Returns violation strings (empty array = PASS).
 * If baseline is null, missing, or structurally broken (not `{ color: number, inlineZh: number }`),
 * returns a single hard-failure violation.
 */
export function evaluateRatchet(
  counts: RatchetCounts,
  baseline: unknown,
  overBudgetFiles: string[],
): string[] {
  const isValidBaseline = (v: unknown): v is RatchetCounts =>
    v !== null &&
    typeof v === 'object' &&
    typeof (v as Record<string, unknown>).color === 'number' &&
    Number.isFinite((v as Record<string, unknown>).color as number) &&
    typeof (v as Record<string, unknown>).inlineZh === 'number' &&
    Number.isFinite((v as Record<string, unknown>).inlineZh as number);

  if (!isValidBaseline(baseline)) {
    return [
      'growth ratchet baseline missing or corrupt at scripts/growth-hotspot-baseline.json — restore it or regenerate',
    ];
  }
  const colorOver = counts.color > baseline.color;
  const zhOver = counts.inlineZh > baseline.inlineZh;
  if (colorOver || zhOver) {
    const msgs: string[] = [];
    if (colorOver) msgs.push(`color: ${counts.color} > baseline ${baseline.color}`);
    if (zhOver) msgs.push(`inlineZh: ${counts.inlineZh} > baseline ${baseline.inlineZh}`);
    return [
      `growth ratchet exceeded — ${msgs.join(', ')}\n  Over-budget files:\n  ${overBudgetFiles.join('\n  ')}`,
    ];
  }
  return [];
}

if (import.meta.main) {
  for (const rule of rules) {
    const absoluteFrom = join(root, rule.from);
    let files: string[] = [];
    try {
      files = walk(absoluteFrom);
    } catch {
      continue;
    }

    for (const file of files) {
      const relativePath = relative(root, file);
      if (rule.include && !rule.include.test(relativePath)) continue;
      if (rule.exclude && rule.exclude.test(relativePath)) continue;
      const rawSource = readFileSync(file, 'utf8');
      const source = rule.stripComments ? stripComments(rawSource) : rawSource;
      for (const pattern of rule.disallowed) {
        if (pattern.test(source)) {
          violations.push(`${relativePath}: ${rule.message}`);
        }
      }
    }
  }

  checkSharedLibIsNotRevived();
  checkTypesIsNotRevived();
  checkApiAppModuleImports();
  checkApiDomainModuleImports();
  checkApiFinalTopLevelLayout();
  checkApiControllerPrismaUsage();
  checkApiRepositoryOnlyPrismaUsage();

  // Growth ratchet check — governed file set
  const baselinePath = join(root, 'scripts/growth-hotspot-baseline.json');
  let baseline: RatchetCounts | null = null;
  try {
    baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  } catch {
    // baseline missing or corrupt — evaluateRatchet will produce a hard-failure violation
  }

  {
    let totalColor = 0;
    let totalInlineZh = 0;
    const overBudgetFiles: string[] = [];

    // Collect all governed files: dirs + extra individual files
    const governedFiles: string[] = [];
    for (const dir of RATCHET_GOVERNED_DIRS) {
      try {
        governedFiles.push(
          ...walk(join(root, dir)).filter(
            (f) => !f.endsWith('.spec.ts') && !f.endsWith('.test.ts'),
          ),
        );
      } catch {
        // dir not found — still continue; missing baseline check will fire if needed
      }
    }
    for (const extraFile of RATCHET_GOVERNED_EXTRA_FILES) {
      const abs = join(root, extraFile);
      if (!governedFiles.includes(abs)) {
        governedFiles.push(abs);
      }
    }

    for (const file of governedFiles) {
      let src: string;
      try {
        src = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const counts = countGrowthViolations(src);
      if (counts.color > 0 || counts.inlineZh > 0) {
        overBudgetFiles.push(`${relative(root, file)} (color:${counts.color} inlineZh:${counts.inlineZh})`);
      }
      totalColor += counts.color;
      totalInlineZh += counts.inlineZh;
    }

    for (const v of evaluateRatchet({ color: totalColor, inlineZh: totalInlineZh }, baseline, overBudgetFiles)) {
      violations.push(v);
    }
  }

  if (violations.length > 0) {
    console.error('Architecture boundary violations found:\n');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  console.log('Architecture boundary check passed.');
}
