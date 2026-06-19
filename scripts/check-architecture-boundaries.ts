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
    ],
    message: 'shared-ui cannot depend on services, clients, or database',
  },
  {
    from: 'packages/shared-ui/src/admin',
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'shared-ui/admin request orchestration belongs in shared-store actions or sdk-facing controllers',
  },
  {
    from: 'packages/shared-ui/src/library',
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'shared-ui/library request orchestration belongs in shared-store actions or sdk-facing controllers',
  },
  {
    from: 'packages/shared-ui/src/hooks',
    include: /useModelConfigEnabled\.tsx?$/,
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'system feature flag requests belong in shared-store',
  },
  {
    from: 'packages/shared-ui/src/video',
    include: /(?:MaterialPicker|VideoHistoryPanel|VideoModelSelector|VideoTemplatePickerSheet|VideoToolbar)\.tsx$/,
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'migrated video UI request orchestration belongs in shared-store controllers',
  },
  {
    from: 'packages/shared-ui/src/materials',
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'shared-ui/materials request orchestration belongs in shared-store actions',
  },
  {
    from: 'packages/shared-ui/src/marketplace/forms',
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'marketplace publish forms must use shared-store marketplace actions and domain types',
  },
  {
    from: 'packages/shared-ui/src/marketplace',
    include: /(?:EditorPicks|HotRankingList|MarketplaceTopNav|PlatformStats|ResourceCard|ResourceGrid|ResourcePanel|RuntimeBadge|resource-utils)\.tsx?$/,
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'migrated marketplace resource UI must use shared-store actions and exported types',
  },
  {
    from: 'packages/shared-ui/src/template',
    include: /(?:ImageUploader|TemplateCard|TemplateFormDrawer|VariableEditor)\.tsx$/,
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'shared template UI must use shared-store actions and exported types',
  },
  {
    from: 'packages/shared-ui/src/chat',
    include: /(?:ChatInput|ChatPromptInput|InputModeSwitch|MessageBubble|ModeSwitcher|ModelPickerPopover|ResourceLauncher|TemplatePromptDialog|agent-kind-utils|chat-attachments)\.tsx?$/,
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'migrated chat UI must use shared-store actions and exported contracts',
  },
  {
    from: 'packages/shared-ui/src/arena',
    disallowed: [/from\s+['"]@autix\/sdk/],
    message: 'arena UI request orchestration belongs in shared-store arena actions',
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
    if (rule.include && !rule.include.test(file)) continue;
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
