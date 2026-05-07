#!/usr/bin/env bun
/**
 * 多资源市场种子数据(Skills / MCP / Agents / Video Templates)
 *
 * 用法: bun run --filter=@autix/chat seed:resources
 * 环境变量:
 *   CHAT_DATABASE_URL  必填
 *   AUTHOR_ID          可选,默认 "seed-author"(与 seed-templates.ts 共用)
 *
 * 设计:
 *   - 4 类资源各预置 4 条常用初始化值,与图片模板保持一致的 cover/exampleMedia 风格
 *   - runtime 标记按真实规则:stdio MCP 与 stdio 依赖项 → DESKTOP_ONLY,其它 → CLOUD
 *   - 全部 status=APPROVED 直接上架
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { normalizeMcpConfig } from '../src/common/mcp-config.parser';
import { parseSkillMarkdown } from '../src/common/skill-markdown.parser';

const adapter = new PrismaPg({ connectionString: process.env.CHAT_DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const AUTHOR_ID = process.env.AUTHOR_ID || 'seed-author';

// ── Unsplash CC 图片(已 HEAD 校验) ────────────────────────────────────────
const img = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format`;

const COVERS = {
  codeReview: img('photo-1555066931-4365d14bab8c'),
  sqlExpert: img('photo-1551288049-bebda4e38f71'),
  prdWriter: img('photo-1455390582262-044cdead277a'),
  contentPolish: img('photo-1456513080510-7bf3a84b82f8'),

  postgres: img('photo-1544383835-bda2bc66a55d'),
  notion: img('photo-1611162616305-c69b3fa7fbe0'),
  github: img('photo-1618401471353-b98afee0b2eb'),
  filesystem: img('photo-1606166187734-a4cb74079037'),

  prdAgent: img('photo-1531746790731-6c087fecd65a'),
  devops: img('photo-1593642632559-0c6d3fc62b89'),
  growth: img('photo-1611162617213-7d7a39e9b1d7'),
  support: img('photo-1556761175-5973dc0f32e7'),

  videoMarketing: img('photo-1574717024653-61fd2cf4d44d'),
  videoTutorial: img('photo-1517048676732-d65bc937f952'),
  videoStory: img('photo-1485846234645-a62644f84728'),
  videoFestival: img('photo-1481627834876-b7833e8f5570'),
};

const EX = {
  laptopCode: img('photo-1517694712202-14dd9538aa97'),
  circuitBoard: img('photo-1518770660439-4636190af475'),
  dataCenter: img('photo-1488229297570-58520851e868'),
  developerWorking: img('photo-1556075798-4825dfaaf498'),
  laptopCoffee: img('photo-1486312338219-ce68d2c6f44d'),
  postIts: img('photo-1542744173-8e7e53415bb0'),
  meetingPlanning: img('photo-1551434678-e076c223a692'),
  terminal: img('photo-1573164574572-cb89e39749b4'),
  campaignPlanning: img('photo-1542744095-fcf48d80b0fd'),
  chatBubbles: img('photo-1611174743420-3d7df880ce32'),
  chatSupport: img('photo-1532619675605-1ede6c2ed2b0'),
  recording: img('photo-1571260899304-425eee4c7efc'),
  filmmaking: img('photo-1478720568477-152d9b164e26'),
  cinemaSeats: img('photo-1503676260728-1c00da094a0b'),
  partyLights: img('photo-1542204165-65bf26472b9b'),
  newYearFireworks: img('photo-1496180470114-6ef490f3ff22'),
};

const skillMarkdown = (
  frontmatter: Record<string, unknown>,
  body: string,
) => {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push('---', '', body.trim());
  return lines.join('\n');
};

// ── Types ───────────────────────────────────────────────────────────────────
interface Variable {
  key: string;
  label: string;
  type: string;
  default?: string;
  options?: string[];
}

interface SkillSeed {
  title: string;
  description: string;
  category: string;
  rawMarkdown?: string;
  instructions: string;
  frontmatter: Record<string, unknown>;
  variables: Variable[];
  coverImage: string;
  exampleMedia: string[];
  modelHint?: string;
  tags: string[];
  pointsCost: number;
  useCount: number;
  likeCount: number;
}

interface McpSeed {
  title: string;
  description: string;
  category: string;
  rawConfig: Record<string, unknown>;
  serverName: string;
  transport?: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  envSchema?: Record<string, unknown>;
  url?: string;
  coverImage: string;
  exampleMedia: string[];
  tags: string[];
  pointsCost: number;
  runtimeRequirement: 'CLOUD' | 'DESKTOP_ONLY';
  runtimeReason: string;
  useCount: number;
  likeCount: number;
}

interface AgentSeed {
  title: string;
  description: string;
  category: string;
  systemPrompt: string;
  toolBindings: { mcps: string[]; skills: string[] };
  defaultModel: string;
  variables: Variable[];
  coverImage: string;
  exampleMedia: string[];
  tags: string[];
  pointsCost: number;
  useCount: number;
  likeCount: number;
}

interface VideoSeed {
  title: string;
  description: string;
  category: string;
  prompt: string;
  variables: Variable[];
  coverImage: string;
  exampleMedia: string[];
  modelHint: string;
  durationSec: number;
  tags: string[];
  pointsCost: number;
  useCount: number;
  likeCount: number;
}

// ── Skills ──────────────────────────────────────────────────────────────────
const skills: SkillSeed[] = [
  {
    title: '代码评审专家',
    description:
      '资深工程师视角的代码评审 Skill。会从可读性、性能、安全、测试覆盖率、错误处理 5 个维度逐项给出可执行建议,并定位高风险代码段。',
    category: '研发',
    instructions: `你是一位有 10 年经验的资深工程师。当用户贴出代码或 PR diff 时,请按以下结构进行评审:

1. **整体评价**:用 1-2 句话概括代码质量与主要风险。
2. **逐项审查**:对每个文件/函数,从下列维度依次点评:
   - 可读性与命名(变量、函数、模块名)
   - 性能与复杂度(避免 O(n²) 隐患、不必要的拷贝)
   - 安全性(注入、越权、敏感日志、密钥泄露)
   - 错误处理与边界条件
   - 测试覆盖率与可测性
3. **高优先级问题**:用 ⚠️ 标记必须修复的问题,给出修复建议(代码示例)。
4. **低优先级建议**:用 💡 标记可选改进,不阻塞合并。
5. **最终结论**:approve / request changes / needs discussion 三选一,并给出原因。

回答语言与用户输入语言保持一致。代码示例使用 Markdown 代码块。`,
    frontmatter: {
      model: 'gpt-5',
      temperature: 0.3,
      tags: ['code-review', 'engineering'],
      example: '请评审下面这个 React 组件的 PR diff: ...',
    },
    variables: [
      {
        key: 'language',
        label: '主要语言',
        type: 'select',
        default: 'TypeScript',
        options: ['TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++'],
      },
      {
        key: 'strictness',
        label: '严格度',
        type: 'select',
        default: '中',
        options: ['宽松', '中', '严格'],
      },
    ],
    coverImage: COVERS.codeReview,
    exampleMedia: [EX.laptopCode, EX.circuitBoard],
    modelHint: 'gpt-5',
    tags: ['代码评审', 'Code Review', '研发', '工程实践'],
    pointsCost: 0,
    useCount: 1247,
    likeCount: 583,
  },
  {
    title: 'SQL 优化助手',
    description:
      '专攻 SQL 查询优化与索引设计。提供 EXPLAIN 解读、索引建议、改写方案、N+1 检测等。覆盖 PostgreSQL / MySQL / SQLite。',
    category: '研发',
    instructions: `你是一位精通 RDBMS 的 DBA。当用户提供 SQL 与执行计划时,按以下流程帮其优化:

1. **解读执行计划**:翻译 EXPLAIN 输出关键节点(Seq Scan / Index Scan / Hash Join 等),指出代价最大的步骤。
2. **诊断瓶颈**:
   - 是否有全表扫描可避免?
   - 索引是否命中,是否需要联合索引/覆盖索引?
   - 是否存在 N+1 查询、深度分页(OFFSET 大)、隐式类型转换?
3. **提供改写方案**:给出至少 2 种候选 SQL,并标注预期改善幅度。
4. **索引建议**:列出新增/调整的 \`CREATE INDEX\` 语句,说明字段顺序与覆盖列的考量。
5. **风险提示**:指出新索引带来的写入开销、锁与统计信息维护成本。

如果用户仅给出 SQL 但没附执行计划,请先要求其提供 \`EXPLAIN (ANALYZE, BUFFERS) ...\` 输出。`,
    frontmatter: {
      model: 'gpt-5',
      temperature: 0.2,
      tags: ['sql', 'database', 'performance'],
    },
    variables: [
      {
        key: 'dialect',
        label: '数据库方言',
        type: 'select',
        default: 'PostgreSQL',
        options: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server', 'Oracle'],
      },
    ],
    coverImage: COVERS.sqlExpert,
    exampleMedia: [EX.dataCenter, EX.developerWorking],
    modelHint: 'gpt-5',
    tags: ['SQL', '数据库', '性能优化', 'DBA'],
    pointsCost: 0,
    useCount: 892,
    likeCount: 401,
  },
  {
    title: 'PRD 撰写助手',
    description:
      '把一句话需求扩展为结构化 PRD,涵盖背景、目标、用户故事、功能点、非功能要求、验收标准、风险与里程碑。',
    category: '写作',
    instructions: `你是产品经理,擅长把模糊需求转写为可交付的 PRD。当用户描述需求后,按以下章节输出:

## 1. 背景与价值
- 为谁解决什么问题?业务收益(可量化指标)?

## 2. 目标(SMART)
- 1-3 条具体目标,每条带可衡量的成功指标。

## 3. 用户与场景
- 主要 persona、典型 use case、frequency。

## 4. 功能需求
- 按优先级(P0/P1/P2)列出功能点,每条含描述、输入、输出、规则。
- 关键流程画 ASCII 流程图或文字时序。

## 5. 非功能需求
- 性能、可靠性、安全、合规、国际化、可访问性。

## 6. 验收标准
- 按 GIVEN / WHEN / THEN 写 5-10 条测试用例。

## 7. 风险与依赖
- 技术风险、外部依赖、回退方案。

## 8. 里程碑
- 切分阶段 + 估时(开发/测试/上线)。

输出尽量精炼;若用户描述不足,先列出需要澄清的 3-5 个问题。`,
    frontmatter: {
      model: 'gpt-5',
      temperature: 0.5,
      tags: ['prd', 'product-management'],
    },
    variables: [
      {
        key: 'product_type',
        label: '产品类型',
        type: 'select',
        default: 'SaaS Web',
        options: ['SaaS Web', '移动 App', '桌面应用', 'API / SDK', '内部工具'],
      },
      {
        key: 'team_size',
        label: '团队规模',
        type: 'select',
        default: '小型(<10 人)',
        options: ['小型(<10 人)', '中型(10-50 人)', '大型(50+ 人)'],
      },
    ],
    coverImage: COVERS.prdWriter,
    exampleMedia: [EX.postIts, EX.laptopCoffee],
    modelHint: 'gpt-5',
    tags: ['PRD', '产品', '需求文档', '写作'],
    pointsCost: 0,
    useCount: 1856,
    likeCount: 729,
  },
  {
    title: '中英文润色编辑',
    description:
      '资深双语编辑,既能把中文改得更地道流畅,也能把英文改得更 native。会标注修改原因,可指定行文风格(正式/轻松/学术/营销)。',
    category: '写作',
    instructions: `你是一位有 15 年经验的双语编辑。当用户提供文本时:

1. **识别原始语言**(中文 / 英文 / 中英混排),保持目标语言一致。
2. **按指定风格润色**:
   - **formal**:逻辑严密、用词正式,适合官方文档、合同。
   - **casual**:口语化、有温度,适合社媒、博客。
   - **academic**:句式严谨、引用准确,适合论文、研究报告。
   - **marketing**:有力、有钩子、能打动读者,适合营销文案。
3. **输出 3 段**:
   - 段 1:润色后版本(直接给出最终稿)。
   - 段 2:核心改动列表(用 \`原句 → 改后\` 形式,每条配 1 句改动理由)。
   - 段 3:可选的 1-2 个替代版本(如果用户给的语境模糊)。

务必保留原文的事实、数字、专有名词。中文不要无故西化;英文不要中式表达。`,
    frontmatter: {
      model: 'gpt-5',
      temperature: 0.6,
      tags: ['writing', 'editing', 'bilingual'],
    },
    variables: [
      {
        key: 'style',
        label: '行文风格',
        type: 'select',
        default: 'formal',
        options: ['formal', 'casual', 'academic', 'marketing'],
      },
      {
        key: 'preserve_jargon',
        label: '是否保留术语原文',
        type: 'select',
        default: '是',
        options: ['是', '否(全部翻译)'],
      },
    ],
    coverImage: COVERS.contentPolish,
    exampleMedia: [COVERS.prdWriter, EX.laptopCoffee],
    modelHint: 'gpt-5',
    tags: ['润色', '编辑', '中英文', '写作'],
    pointsCost: 0,
    useCount: 1024,
    likeCount: 488,
  },
];

// ── MCP Servers ─────────────────────────────────────────────────────────────
const mcps: McpSeed[] = [
  {
    title: 'PostgreSQL MCP',
    description:
      '通过本地 stdio 连接你的 Postgres 数据库。支持 schema 内省、查询执行、迁移文件解析。仅桌面端可用。',
    category: '数据库',
    serverName: 'postgres',
    rawConfig: {
      mcpServers: {
        postgres: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres'],
          env: {
            DATABASE_URL: '${DATABASE_URL}',
          },
        },
      },
    },
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    envSchema: {
      DATABASE_URL: {
        type: 'string',
        required: true,
        description: 'postgres://user:pass@host:5432/dbname',
      },
    },
    coverImage: COVERS.postgres,
    exampleMedia: [EX.dataCenter, EX.terminal],
    tags: ['Postgres', '数据库', 'MCP', 'stdio'],
    pointsCost: 0,
    runtimeRequirement: 'DESKTOP_ONLY',
    runtimeReason: 'stdio transport 必须本地启动进程',
    useCount: 678,
    likeCount: 312,
  },
  {
    title: 'Sequential Thinking MCP',
    description:
      '官方 sequential-thinking MCP,用于把复杂任务拆成可审计的推理步骤。通过 stdio 本地启动,适合桌面端增强规划能力。',
    category: '开发工具',
    serverName: 'sequential-thinking',
    rawConfig: {
      mcpServers: {
        'sequential-thinking': {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
          env: {},
        },
      },
    },
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    envSchema: {},
    coverImage: COVERS.notion,
    exampleMedia: [EX.postIts, EX.laptopCoffee],
    tags: ['Sequential Thinking', '规划', 'MCP', 'stdio'],
    pointsCost: 0,
    runtimeRequirement: 'DESKTOP_ONLY',
    runtimeReason: 'stdio transport 必须本地启动进程',
    useCount: 945,
    likeCount: 412,
  },
  {
    title: 'GitHub MCP',
    description:
      '托管 SSE 桥接 GitHub REST/GraphQL,支持 PR 评审、Issue 管理、文件读写。Web 与 Desktop 通用。',
    category: '开发工具',
    serverName: 'github',
    rawConfig: {
      mcpServers: {
        github: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PERSONAL_ACCESS_TOKEN}',
          },
        },
      },
    },
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envSchema: {
      GITHUB_PERSONAL_ACCESS_TOKEN: {
        type: 'string',
        required: true,
        description: 'GitHub PAT,需 repo + read:user 权限',
      },
    },
    coverImage: COVERS.github,
    exampleMedia: [EX.developerWorking, EX.laptopCode],
    tags: ['GitHub', 'Git', 'MCP', 'stdio'],
    pointsCost: 0,
    runtimeRequirement: 'DESKTOP_ONLY',
    runtimeReason: 'stdio transport 必须本地启动进程',
    useCount: 1532,
    likeCount: 687,
  },
  {
    title: 'Filesystem MCP',
    description:
      '本地文件系统访问。读写、搜索、grep、watch 都走 stdio,适合在桌面端做代码辅助、笔记整理。仅桌面端可用。',
    category: '开发工具',
    serverName: 'filesystem',
    rawConfig: {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '${HOME}/Documents'],
          env: {
            ALLOWED_PATHS: '${HOME}/Documents',
          },
        },
      },
    },
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '${HOME}/Documents'],
    envSchema: {
      ALLOWED_PATHS: {
        type: 'string',
        required: false,
        description: '允许访问的目录,逗号分隔。默认仅 ${HOME}/Documents',
      },
    },
    coverImage: COVERS.filesystem,
    exampleMedia: [EX.terminal, EX.laptopCode],
    tags: ['Filesystem', '本地文件', 'MCP', 'stdio'],
    pointsCost: 0,
    runtimeRequirement: 'DESKTOP_ONLY',
    runtimeReason: 'stdio transport + env 含本地路径变量',
    useCount: 489,
    likeCount: 246,
  },
];

// ── Agents ──────────────────────────────────────────────────────────────────
const agents: AgentSeed[] = [
  {
    title: 'PRD 助手 Agent',
    description:
      '从一句话想法到完整 PRD 的全流程 Agent。会主动追问澄清,产出结构化文档,并自动生成 user stories 与验收标准。',
    category: '产品',
    systemPrompt: `你是产品经理 Agent,目标是帮用户产出可交付的 PRD。

工作流程:
1. **澄清阶段**:首先用 3-5 个问题理解需求(目标用户、核心场景、约束、成功指标)。
2. **草稿阶段**:输出包含背景/目标/功能/非功能/验收/风险/里程碑 7 章节的初稿。
3. **迭代阶段**:根据用户反馈逐章修订,保留 changelog。
4. **交付阶段**:产出最终 PRD + 一份对应的 user stories(Given/When/Then 格式)。

工具使用:
- 复杂概念可借助 Skills 中的「PRD 撰写助手」进行二次润色。

风格:务实、可量化、不写正确的废话。`,
    toolBindings: { mcps: [], skills: [] },
    defaultModel: 'gpt-5',
    variables: [
      {
        key: 'product_stage',
        label: '产品阶段',
        type: 'select',
        default: 'MVP',
        options: ['MVP', '0→1', '1→10', '10→100'],
      },
    ],
    coverImage: COVERS.prdAgent,
    exampleMedia: [EX.postIts, EX.meetingPlanning],
    tags: ['PRD', '产品经理', 'Agent', '需求'],
    pointsCost: 480,
    useCount: 1245,
    likeCount: 612,
  },
  {
    title: 'DevOps 工程师 Agent',
    description:
      '帮你写 Dockerfile / k8s manifest / CI 流水线,排查容器问题、优化部署成本。需要绑定 Filesystem MCP 时仅桌面端可用。',
    category: '研发',
    systemPrompt: `你是资深 DevOps Agent,擅长容器化、CI/CD、K8s、可观测性。

行为准则:
1. **先看现状**:让用户描述当前部署架构(自托管 / Cloud Run / EKS / Vercel 等)。
2. **再问目标**:扩缩容指标、SLA、预算、合规要求。
3. **给方案**:产出可直接用的 Dockerfile / Helm / GitHub Actions 文件,并解释每段的作用。
4. **算成本**:对每个方案给出大致月成本估算与瓶颈分析。

输出:Markdown + 代码块。命令前缀清晰(\`$\` for shell, \`#\` for comment)。`,
    toolBindings: { mcps: [], skills: [] },
    defaultModel: 'gpt-5',
    variables: [
      {
        key: 'platform',
        label: '部署平台',
        type: 'select',
        default: 'Kubernetes',
        options: ['Kubernetes', 'Docker Compose', 'Cloud Run', 'AWS ECS', 'Vercel'],
      },
    ],
    coverImage: COVERS.devops,
    exampleMedia: [EX.terminal, EX.dataCenter],
    tags: ['DevOps', 'Kubernetes', 'CI/CD', 'Agent'],
    pointsCost: 580,
    useCount: 678,
    likeCount: 289,
  },
  {
    title: '增长策略 Agent',
    description:
      '面向 0-1 / 1-10 阶段的增长 Agent。会基于 AARRR 漏斗给出可落地的实验方案,产出 ICE 评分表与 A/B 测试设计。',
    category: '营销',
    systemPrompt: `你是 Growth Hacker Agent,熟悉 AARRR 模型与精益创业。

工作方式:
1. **诊断**:先要求用户提供 4 个数字(MAU / 转化率 / 留存 / ARPU),没有就给行业基准。
2. **拆漏斗**:按 Acquisition / Activation / Retention / Revenue / Referral 各列出 5 个改善点。
3. **打分**:用 ICE(Impact × Confidence × Ease)给每个改善点打分(1-10),按总分降序。
4. **写实验**:Top 3 的改善点,每个产出一份 A/B 测试设计:假设、对照/实验组、指标、样本量、跑期。
5. **给文案**:如果改善涉及落地页/邮件,直接产出 1-2 版文案候选。

不写空话。每个建议都必须能在两周内启动。`,
    toolBindings: { mcps: [], skills: [] },
    defaultModel: 'gpt-5',
    variables: [
      {
        key: 'channel',
        label: '主要渠道',
        type: 'select',
        default: 'SEO',
        options: ['SEO', 'Paid Ads', 'Social', 'Community', 'PLG'],
      },
      {
        key: 'goal',
        label: '当前目标',
        type: 'select',
        default: 'activation',
        options: ['acquisition', 'activation', 'retention', 'revenue', 'referral'],
      },
    ],
    coverImage: COVERS.growth,
    exampleMedia: [EX.campaignPlanning, EX.meetingPlanning],
    tags: ['增长', '营销', 'AARRR', 'Agent'],
    pointsCost: 380,
    useCount: 845,
    likeCount: 401,
  },
  {
    title: '客户支持 Agent',
    description:
      '7×24 客服 Agent。会按 SOP 处理常见问题,识别情绪,在无法解决时礼貌升级到人工,并自动产出工单摘要。',
    category: '客服',
    systemPrompt: `你是品牌客服 Agent,目标是提供专业、共情、快速的支持。

行为准则:
1. **情绪识别**:首先判断用户情绪(正常/焦虑/愤怒),回复语气随之调整。
2. **意图归类**:把问题归到 5 类之一:
   - 账户(登录/密码/订阅)
   - 计费(账单/退款/发票)
   - 功能(使用/Bug/数据)
   - 反馈(建议/投诉)
   - 其他
3. **匹配 SOP**:每类有标准答复模板,但要根据上下文改写,不要机械复制。
4. **关键边界**:涉及退款超过 ¥500 / 数据安全事件 / 法律纠纷,立即升级到人工 + 给出工单号格式 \`TKT-YYYYMMDD-XXXX\`。
5. **会话总结**:每轮结束输出 3 句话总结(问题/动作/未决事项),便于人工接手。

输出语气与用户语言保持一致。`,
    toolBindings: { mcps: [], skills: [] },
    defaultModel: 'gpt-5',
    variables: [
      {
        key: 'brand_name',
        label: '品牌名',
        type: 'text',
        default: 'Amux Studio',
      },
      {
        key: 'tone',
        label: '语气',
        type: 'select',
        default: 'warm-professional',
        options: ['warm-professional', 'casual-friendly', 'concise-formal'],
      },
    ],
    coverImage: COVERS.support,
    exampleMedia: [EX.chatBubbles, EX.chatSupport],
    tags: ['客服', 'Customer Support', 'Agent', 'SOP'],
    pointsCost: 280,
    useCount: 567,
    likeCount: 234,
  },
];

// ── Video Templates ─────────────────────────────────────────────────────────
const videos: VideoSeed[] = [
  {
    title: '15 秒营销短视频',
    description:
      '高节奏营销短视频脚本与镜头规划。适合电商种草、品牌引流、新品发布。可输出分镜表与配音稿。',
    category: '营销',
    prompt: `Create a {{duration}}-second marketing short video for a {{product_type}} targeting {{audience}}. The hook in the first 2 seconds is "{{hook}}". The visual style is {{style}} with {{pace}} pacing. Background music: {{music}}. Voice-over tone: {{vo_tone}}. End with CTA "{{cta}}". Storyboard structure: Hook → Problem → Solution showcase → Social proof → CTA. Vertical 9:16 aspect ratio, 60fps capable.`,
    variables: [
      {
        key: 'duration',
        label: '时长(秒)',
        type: 'select',
        default: '15',
        options: ['9', '15', '30', '60'],
      },
      {
        key: 'product_type',
        label: '产品类型',
        type: 'text',
        default: 'AI 写作工具',
      },
      {
        key: 'audience',
        label: '目标人群',
        type: 'text',
        default: '内容创作者 / 自媒体',
      },
      {
        key: 'hook',
        label: '首句钩子',
        type: 'text',
        default: '别再花 3 小时写一篇推文了',
      },
      {
        key: 'style',
        label: '视觉风格',
        type: 'select',
        default: 'punchy modern',
        options: ['punchy modern', 'minimal premium', 'lifestyle warm', 'tech futuristic'],
      },
      {
        key: 'pace',
        label: '节奏',
        type: 'select',
        default: 'fast cuts',
        options: ['fast cuts', 'medium', 'slow cinematic'],
      },
      {
        key: 'music',
        label: '配乐',
        type: 'text',
        default: 'upbeat electronic with a catchy hook',
      },
      {
        key: 'vo_tone',
        label: '配音语气',
        type: 'select',
        default: 'energetic',
        options: ['energetic', 'authoritative', 'friendly conversational', 'urgent'],
      },
      {
        key: 'cta',
        label: 'CTA',
        type: 'text',
        default: '点击主页链接,立即体验',
      },
    ],
    coverImage: COVERS.videoMarketing,
    exampleMedia: [EX.filmmaking, EX.cinemaSeats],
    modelHint: 'sora-2',
    durationSec: 15,
    tags: ['营销', '短视频', '电商', '9:16'],
    pointsCost: 50,
    useCount: 723,
    likeCount: 312,
  },
  {
    title: '产品教学 Walkthrough',
    description:
      '为 SaaS / 工具类产品生成上手教学视频。重点突出关键功能流程,搭配清晰画外音与高亮交互。',
    category: '教学',
    prompt: `Generate a {{duration}}-second product walkthrough video for {{product_name}}. The viewer is a {{user_type}} trying to accomplish "{{user_goal}}". Show the screen flow: {{flow_steps}}. Highlight UI elements with {{highlight_style}}. Voice-over walks through each step in {{vo_tone}} tone. Background: {{background_style}}. End with a recap of the {{key_feature}}. 16:9 aspect ratio, 1080p, screen recording quality.`,
    variables: [
      {
        key: 'duration',
        label: '时长(秒)',
        type: 'select',
        default: '60',
        options: ['30', '60', '90', '120'],
      },
      {
        key: 'product_name',
        label: '产品名',
        type: 'text',
        default: 'Amux Studio',
      },
      {
        key: 'user_type',
        label: '用户类型',
        type: 'text',
        default: '第一次使用的产品经理',
      },
      {
        key: 'user_goal',
        label: '用户目标',
        type: 'text',
        default: '把一句话需求扩成一份完整 PRD',
      },
      {
        key: 'flow_steps',
        label: '流程步骤',
        type: 'text',
        default: '登录 → 新建项目 → 输入需求 → AI 生成 PRD → 审阅与导出',
      },
      {
        key: 'highlight_style',
        label: '高亮样式',
        type: 'select',
        default: 'animated cursor + soft glow',
        options: ['animated cursor + soft glow', 'colored bounding boxes', 'zoom-in pop', 'arrow callouts'],
      },
      {
        key: 'vo_tone',
        label: '配音语气',
        type: 'select',
        default: 'friendly-clear',
        options: ['friendly-clear', 'authoritative-tutorial', 'playful'],
      },
      {
        key: 'background_style',
        label: '背景',
        type: 'select',
        default: 'clean white',
        options: ['clean white', 'dark mode', 'gradient soft', 'lifestyle context'],
      },
      {
        key: 'key_feature',
        label: '核心卖点',
        type: 'text',
        default: 'AI 一键生成结构化 PRD,省 3 小时',
      },
    ],
    coverImage: COVERS.videoTutorial,
    exampleMedia: [EX.recording, EX.laptopCoffee],
    modelHint: 'sora-2',
    durationSec: 60,
    tags: ['教学', '产品演示', 'Tutorial', '16:9'],
    pointsCost: 50,
    useCount: 489,
    likeCount: 198,
  },
  {
    title: '电影感故事短片',
    description:
      '叙事型短片脚本与分镜。适合品牌故事、人物纪录、情感广告。可指定情绪曲线与色彩基调。',
    category: '故事',
    prompt: `A cinematic narrative short film of {{duration}} seconds, telling the story of {{character}} who {{conflict}}. The story arc follows {{structure}}. Visual style is {{cinema_style}} with {{color_grade}} color grade. Aspect ratio {{aspect}}. Music score: {{music}}. Emotional curve: {{emotion_arc}}. The opening shot is {{opening}}, the closing shot is {{closing}}. Award-winning cinematography quality.`,
    variables: [
      {
        key: 'duration',
        label: '时长(秒)',
        type: 'select',
        default: '60',
        options: ['30', '60', '90', '120', '180'],
      },
      {
        key: 'character',
        label: '主角',
        type: 'text',
        default: '一位独自工作的独立设计师',
      },
      {
        key: 'conflict',
        label: '核心冲突',
        type: 'text',
        default: '在凌晨 3 点为新产品反复打磨最后一个像素',
      },
      {
        key: 'structure',
        label: '叙事结构',
        type: 'select',
        default: 'three-act',
        options: ['three-act', 'in-medias-res', 'non-linear flashback', 'ring-composition'],
      },
      {
        key: 'cinema_style',
        label: '电影风格',
        type: 'select',
        default: 'A24 indie',
        options: ['A24 indie', 'Wes Anderson symmetric', 'Christopher Nolan epic', 'Wong Kar-wai dreamy', 'documentary realism'],
      },
      {
        key: 'color_grade',
        label: '调色',
        type: 'select',
        default: 'warm orange-teal',
        options: ['warm orange-teal', 'desaturated cool', 'high-contrast B&W', 'pastel dreamy', 'natural earthy'],
      },
      {
        key: 'aspect',
        label: '画幅',
        type: 'select',
        default: '2.39:1',
        options: ['2.39:1', '16:9', '4:3', '1:1', '9:16'],
      },
      {
        key: 'music',
        label: '配乐',
        type: 'text',
        default: 'piano-led ambient with subtle strings',
      },
      {
        key: 'emotion_arc',
        label: '情绪曲线',
        type: 'text',
        default: '从孤独 → 怀疑 → 顿悟 → 释然',
      },
      {
        key: 'opening',
        label: '开场镜头',
        type: 'text',
        default: '深夜公寓窗外的城市灯光,缓慢推近至屏幕前的剪影',
      },
      {
        key: 'closing',
        label: '结尾镜头',
        type: 'text',
        default: '清晨第一缕阳光照在已完成的设计稿上',
      },
    ],
    coverImage: COVERS.videoStory,
    exampleMedia: [EX.cinemaSeats, EX.filmmaking],
    modelHint: 'sora-2',
    durationSec: 60,
    tags: ['故事', '电影感', '品牌', '叙事'],
    pointsCost: 80,
    useCount: 412,
    likeCount: 234,
  },
  {
    title: '节日祝福短片',
    description:
      '通用节日祝福视频模板,自动适配春节/中秋/圣诞/新年等节日的视觉元素与音乐氛围,适合品牌官方账号、私域社群。',
    category: '节日',
    prompt: `A festive {{festival}} greeting video of {{duration}} seconds. The aesthetic blends {{cultural_style}} with modern {{style}} design. Key visual motifs include {{motifs}}. Color palette dominated by {{colors}}. Background music: {{music}}. The greeting message reads "{{message}}", appearing at {{message_timing}}. End with brand element {{brand_element}}. Aspect ratio {{aspect}}, suitable for {{platform}}.`,
    variables: [
      {
        key: 'festival',
        label: '节日',
        type: 'select',
        default: '春节',
        options: ['春节', '中秋', '元旦', '圣诞', '万圣节', '感恩节', '七夕', '情人节'],
      },
      {
        key: 'duration',
        label: '时长(秒)',
        type: 'select',
        default: '15',
        options: ['9', '15', '30', '60'],
      },
      {
        key: 'cultural_style',
        label: '文化基调',
        type: 'select',
        default: 'traditional Chinese',
        options: ['traditional Chinese', 'modern Western', 'Japanese minimalist', 'cross-cultural fusion'],
      },
      {
        key: 'style',
        label: '设计风格',
        type: 'select',
        default: 'flat illustration with motion',
        options: ['flat illustration with motion', 'photorealistic cinematic', '3D rendered playful', 'paper-cut stop motion'],
      },
      {
        key: 'motifs',
        label: '视觉符号',
        type: 'text',
        default: '红灯笼、祥云、福字、烟花、生肖',
      },
      {
        key: 'colors',
        label: '主色调',
        type: 'text',
        default: '中国红、金色、暖橘',
      },
      {
        key: 'music',
        label: '配乐',
        type: 'text',
        default: '欢快的中式电子乐',
      },
      {
        key: 'message',
        label: '祝福语',
        type: 'text',
        default: '新年快乐,万事胜意',
      },
      {
        key: 'message_timing',
        label: '出现时机',
        type: 'select',
        default: 'middle climax',
        options: ['opening', 'middle climax', 'final beat'],
      },
      {
        key: 'brand_element',
        label: '品牌元素',
        type: 'text',
        default: '品牌 logo + 主页二维码',
      },
      {
        key: 'aspect',
        label: '画幅',
        type: 'select',
        default: '9:16',
        options: ['9:16', '1:1', '16:9'],
      },
      {
        key: 'platform',
        label: '投放平台',
        type: 'select',
        default: '抖音/小红书',
        options: ['抖音/小红书', '视频号', 'YouTube Shorts', 'Instagram Reels', '官方网站'],
      },
    ],
    coverImage: COVERS.videoFestival,
    exampleMedia: [EX.partyLights, EX.newYearFireworks],
    modelHint: 'sora-2',
    durationSec: 15,
    tags: ['节日', '祝福', '品牌', '社群'],
    pointsCost: 50,
    useCount: 356,
    likeCount: 178,
  },
];

// ── 执行 ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 多资源市场种子开始...');
  console.log(`   数据库: ${process.env.CHAT_DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`);
  console.log(`   作者 ID: ${AUTHOR_ID}`);
  console.log('');

  const now = new Date();
  const past30d = () =>
    new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);

  let created = 0;
  let skipped = 0;

  // Skills
  console.log('── Skills ──');
  for (const s of skills) {
    const existing = await prisma.skills.findFirst({
      where: { title: s.title, authorId: AUTHOR_ID },
    });
    const rawMarkdown = s.rawMarkdown ?? skillMarkdown(s.frontmatter, s.instructions);
    const parsed = parseSkillMarkdown(rawMarkdown);
    if (existing) {
      await prisma.skills.update({
        where: { id: existing.id },
        data: {
          rawMarkdown,
          sourceFormat: 'skill_md',
          parsedFrontmatter: parsed.frontmatter as object,
          instructions: parsed.instructions,
          frontmatter: parsed.frontmatter as object,
          variables: s.variables as object,
          coverImage: s.coverImage,
          exampleMedia: s.exampleMedia,
          modelHint: s.modelHint ?? parsed.modelHint,
          tags: s.tags,
          pointsCost: s.pointsCost,
          runtimeRequirement: 'CLOUD',
          runtimeDetectedBy: 'AUTO',
          runtimeReason: '未发现客户端依赖',
        } as any,
      });
      console.log(`   ♻️  ${s.title}`);
      skipped++;
      continue;
    }
    await prisma.skills.create({
      data: {
        title: s.title,
        description: s.description,
        category: s.category,
        rawMarkdown,
        sourceFormat: 'skill_md',
        parsedFrontmatter: parsed.frontmatter as object,
        instructions: parsed.instructions,
        frontmatter: parsed.frontmatter as object,
        variables: s.variables as object,
        coverImage: s.coverImage,
        exampleMedia: s.exampleMedia,
        modelHint: s.modelHint,
        tags: s.tags,
        pointsCost: s.pointsCost,
        runtimeRequirement: 'CLOUD',
        runtimeDetectedBy: 'AUTO',
        runtimeReason: '未发现客户端依赖',
        authorId: AUTHOR_ID,
        status: 'APPROVED',
        useCount: s.useCount,
        likeCount: s.likeCount,
        publishedAt: past30d(),
      } as any,
    });
    console.log(`   ✅ ${s.category} / ${s.title}`);
    created++;
  }

  // MCP Servers
  console.log('');
  console.log('── MCP Servers ──');
  for (const m of mcps) {
    const existing = await prisma.mcp_servers.findFirst({
      where: { title: m.title, authorId: AUTHOR_ID },
    });
    const normalized = normalizeMcpConfig(m.rawConfig, m.serverName);
    if (existing) {
      await prisma.mcp_servers.update({
        where: { id: existing.id },
        data: {
          description: m.description,
          category: m.category,
          rawConfig: normalized.rawConfig as object,
          configFormat: 'mcp_json',
          serverName: normalized.serverName,
          transport: normalized.transport,
          command: normalized.command,
          args: normalized.args,
          envSchema: (normalized.envSchema as object | undefined) ?? undefined,
          headersSchema: (normalized.headersSchema as object | undefined) ?? undefined,
          authSchema: (normalized.authSchema as object | undefined) ?? undefined,
          tools: (normalized.tools as object | undefined) ?? undefined,
          capabilities: (normalized.capabilities as object | undefined) ?? undefined,
          url: normalized.url,
          coverImage: m.coverImage,
          exampleMedia: m.exampleMedia,
          tags: m.tags,
          pointsCost: m.pointsCost,
          runtimeRequirement: m.runtimeRequirement,
          runtimeDetectedBy: 'AUTO',
          runtimeReason: m.runtimeReason,
        } as any,
      });
      console.log(`   ♻️  ${m.title}`);
      skipped++;
      continue;
    }
    await prisma.mcp_servers.create({
      data: {
        title: m.title,
        description: m.description,
        category: m.category,
        rawConfig: normalized.rawConfig as object,
        configFormat: 'mcp_json',
        serverName: normalized.serverName,
        transport: normalized.transport,
        command: normalized.command,
        args: normalized.args,
        envSchema: (normalized.envSchema as object | undefined) ?? undefined,
        headersSchema: (normalized.headersSchema as object | undefined) ?? undefined,
        authSchema: (normalized.authSchema as object | undefined) ?? undefined,
        tools: (normalized.tools as object | undefined) ?? undefined,
        capabilities: (normalized.capabilities as object | undefined) ?? undefined,
        url: normalized.url,
        coverImage: m.coverImage,
        exampleMedia: m.exampleMedia,
        tags: m.tags,
        pointsCost: m.pointsCost,
        runtimeRequirement: m.runtimeRequirement,
        runtimeDetectedBy: 'AUTO',
        runtimeReason: m.runtimeReason,
        authorId: AUTHOR_ID,
        status: 'APPROVED',
        useCount: m.useCount,
        likeCount: m.likeCount,
        publishedAt: past30d(),
      } as any,
    });
    console.log(`   ✅ ${m.category} / ${m.title}  [${m.runtimeRequirement}]`);
    created++;
  }
  const archivedObsoleteMcps = await prisma.mcp_servers.updateMany({
    where: { title: { in: ['Notion API MCP'] }, authorId: AUTHOR_ID },
    data: {
      status: 'ARCHIVED',
      runtimeRequirement: 'DESKTOP_ONLY',
      runtimeReason: '已由真实 stdio MCP seed 替代',
    },
  });
  if (archivedObsoleteMcps.count > 0) {
    console.log(`   🗄️  归档过期 MCP: ${archivedObsoleteMcps.count}`);
  }

  // Agents
  console.log('');
  console.log('── Agents ──');
  for (const a of agents) {
    const existing = await prisma.agents.findFirst({
      where: { title: a.title, authorId: AUTHOR_ID },
    });
    if (existing) {
      console.log(`   ⏭  ${a.title}`);
      skipped++;
      continue;
    }
    await prisma.agents.create({
      data: {
        title: a.title,
        description: a.description,
        category: a.category,
        systemPrompt: a.systemPrompt,
        toolBindings: a.toolBindings as object,
        defaultModel: a.defaultModel,
        variables: a.variables as object,
        coverImage: a.coverImage,
        exampleMedia: a.exampleMedia,
        tags: a.tags,
        pointsCost: a.pointsCost,
        runtimeRequirement: 'CLOUD',
        runtimeDetectedBy: 'AUTO',
        runtimeReason: '未发现客户端依赖',
        authorId: AUTHOR_ID,
        status: 'APPROVED',
        useCount: a.useCount,
        likeCount: a.likeCount,
        publishedAt: past30d(),
      },
    });
    console.log(`   ✅ ${a.category} / ${a.title}`);
    created++;
  }

  // Video Templates
  console.log('');
  console.log('── Video Templates ──');
  for (const v of videos) {
    const existing = await prisma.video_templates.findFirst({
      where: { title: v.title, authorId: AUTHOR_ID },
    });
    if (existing) {
      console.log(`   ⏭  ${v.title}`);
      skipped++;
      continue;
    }
    await prisma.video_templates.create({
      data: {
        title: v.title,
        description: v.description,
        category: v.category,
        prompt: v.prompt,
        variables: v.variables as object,
        coverImage: v.coverImage,
        exampleMedia: v.exampleMedia,
        modelHint: v.modelHint,
        durationSec: v.durationSec,
        tags: v.tags,
        pointsCost: v.pointsCost,
        runtimeRequirement: 'CLOUD',
        runtimeDetectedBy: 'AUTO',
        runtimeReason: '视频模板恒定云端运行',
        authorId: AUTHOR_ID,
        status: 'APPROVED',
        useCount: v.useCount,
        likeCount: v.likeCount,
        publishedAt: past30d(),
      },
    });
    console.log(`   ✅ ${v.category} / ${v.title}`);
    created++;
  }

  // System Default Workflow Agent
  console.log('');
  console.log('── System Workflow Agent ──');
  const SYSTEM_WORKFLOW_TITLE = '默认产品工作流';
  const existingSystemAgent = await prisma.agents.findFirst({
    where: { title: SYSTEM_WORKFLOW_TITLE, isSystem: true },
  });

  if (existingSystemAgent) {
    console.log(`   ⏭  ${SYSTEM_WORKFLOW_TITLE} (已存在)`);
    skipped++;
  } else {
    const systemAgent = await prisma.agents.create({
      data: {
        title: SYSTEM_WORKFLOW_TITLE,
        description: '从一句话想法到可交付页面代码的全流程工作流。依次产出需求文档、视觉设计稿、技术文档（可选）、页面代码。',
        category: '产品',
        systemPrompt: '你是一个产品全流程工作流 Agent。按阶段依次产出高质量的交付物。每个阶段只专注当前任务，不要提前执行下一阶段。产出后给出对下一步的建议。',
        toolBindings: { mcps: [], skills: [] } as object,
        defaultModel: 'gpt-5',
        variables: [] as object,
        coverImage: COVERS.prdAgent,
        exampleMedia: [EX.postIts, EX.meetingPlanning],
        tags: ['工作流', 'PRD', '设计稿', '代码', '系统'],
        pointsCost: 0,
        isSystem: true,
        executionMode: 'workflow',
        runtimeRequirement: 'CLOUD',
        runtimeDetectedBy: 'AUTO',
        runtimeReason: '系统内置工作流',
        authorId: AUTHOR_ID,
        status: 'APPROVED',
        useCount: 0,
        likeCount: 0,
        publishedAt: now,
      },
    });

    const workflow = await prisma.agent_workflows.create({
      data: {
        agentId: systemAgent.id,
        isDefault: true,
        version: 1,
        steps: {
          create: [
            {
              stepKey: 'prd',
              displayName: '需求文档',
              isOptional: false,
              sortOrder: 0,
              dependencies: [],
              inputArtifactKeys: [],
              executorType: 'deepagent',
              artifactType: 'MARKDOWN',
              promptTemplate: `你是资深产品经理。根据用户的需求描述，产出一份结构化的 PRD（产品需求文档）。

用户输入：
{{userInput}}

{{resources}}

请按以下结构输出：

## 1. 背景与价值
- 解决什么问题？目标用户是谁？业务收益？

## 2. 目标（SMART）
- 具体、可衡量的成功指标

## 3. 用户与场景
- 主要 persona、典型 use case

## 4. 功能需求
- 按优先级（P0/P1/P2）列出，每条含描述、输入、输出、规则
- 关键流程用文字描述

## 5. 非功能需求
- 性能、安全、可用性

## 6. 验收标准
- 5-10 条 GIVEN/WHEN/THEN 测试用例

## 7. 风险与依赖

## 8. 里程碑

务必精炼、可执行。不确定的地方标注 [待确认]。`,
              validationSchema: {
                requiredSections: ['背景', '目标', '功能需求', '验收标准'],
              } as object,
              criticEnabled: true,
              criticPromptTemplate: `评审这份 PRD 的质量。评分维度：
1. 完整性（是否覆盖所有必要章节）
2. 可执行性（功能描述是否足够开发理解）
3. 验收标准（是否具体可测试）
4. 一致性（各章节之间无矛盾）

给出 0-1 的分数和具体改进建议。`,
              criticPassThreshold: 0.7,
              maxRefineAttempts: 2,
            },
            {
              stepKey: 'visual_design',
              displayName: '视觉设计稿',
              isOptional: false,
              sortOrder: 1,
              dependencies: ['prd'],
              inputArtifactKeys: ['prd'],
              executorType: 'deepagent',
              artifactType: 'MARKDOWN',
              promptTemplate: `你是资深 UI/UX 设计师。根据以下需求文档，产出详细的视觉设计稿（Markdown 格式描述）。

需求文档：
{{artifact:prd}}

用户补充说明：
{{userInput}}

{{resources}}

请按以下结构输出：

## 1. 设计理念
- 整体风格、色彩方案、字体选择

## 2. 信息架构
- 页面层级、导航结构

## 3. 页面设计
- 逐页描述布局、组件、交互
- 每个页面包含：页面名称、布局描述、核心组件列表、交互行为

## 4. 组件规范
- 按钮、表单、卡片等通用组件的样式规范

## 5. 响应式适配
- 断点策略、移动端适配方案

## 6. 交互细节
- 动画、过渡、加载状态、错误状态`,
              validationSchema: {
                requiredSections: ['设计理念', '页面设计', '组件规范'],
              } as object,
              criticEnabled: true,
              criticPromptTemplate: `评审这份视觉设计稿：
1. 与 PRD 的一致性（是否覆盖所有功能点）
2. 可实现性（前端是否能据此开发）
3. 用户体验（信息层级、交互合理性）
4. 规范完整度（组件是否有明确规格）

给出 0-1 的分数和具体改进建议。`,
              criticPassThreshold: 0.7,
              maxRefineAttempts: 2,
            },
            {
              stepKey: 'technical_doc',
              displayName: '技术文档',
              isOptional: true,
              sortOrder: 2,
              dependencies: ['prd', 'visual_design'],
              inputArtifactKeys: ['prd', 'visual_design'],
              executorType: 'deepagent',
              artifactType: 'MARKDOWN',
              promptTemplate: `你是资深全栈工程师。根据以下需求文档和视觉设计稿，产出详细的技术设计文档。

需求文档：
{{artifact:prd}}

视觉设计稿：
{{artifact:visual_design}}

用户补充说明：
{{userInput}}

{{resources}}

请按以下结构输出：

## 1. 技术选型
- 框架、语言、核心库

## 2. 数据模型
- 实体定义、字段类型、关系

## 3. API 设计
- 接口列表、请求/响应格式

## 4. 组件架构
- 组件树、状态管理方案

## 5. 关键实现
- 复杂逻辑的实现思路

## 6. 部署方案
- 构建、部署、环境配置`,
              validationSchema: {
                requiredSections: ['技术选型', '数据模型', '组件架构'],
              } as object,
              criticEnabled: false,
              maxRefineAttempts: 2,
            },
            {
              stepKey: 'page_code',
              displayName: '页面代码',
              isOptional: false,
              sortOrder: 3,
              dependencies: ['visual_design'],
              inputArtifactKeys: ['prd', 'visual_design', 'technical_doc'],
              executorType: 'deepagent',
              artifactType: 'CODE',
              promptTemplate: `你是资深前端工程师。根据以下设计文档，产出可运行的页面代码。

需求文档：
{{artifact:prd}}

视觉设计稿：
{{artifact:visual_design}}

{{#artifact:technical_doc}}
技术文档：
{{artifact:technical_doc}}
{{/artifact:technical_doc}}

用户补充说明：
{{userInput}}

{{resources}}

要求：
1. 使用 React + TypeScript
2. 使用 Tailwind CSS 进行样式
3. 组件化设计，每个页面/模块独立
4. 包含必要的类型定义
5. 代码可直接运行，不依赖未声明的外部模块
6. 包含基本的错误处理和加载状态

输出完整的可运行代码。`,
              validationSchema: {
                codeCheck: true,
              } as object,
              criticEnabled: true,
              criticPromptTemplate: `评审这份页面代码：
1. 与设计稿的一致性（是否实现了所有页面和组件）
2. 代码质量（类型安全、组件化、可维护性）
3. 可运行性（是否有语法错误、缺失依赖）
4. 用户体验（加载状态、错误处理、响应式）

给出 0-1 的分数和具体改进建议。`,
              criticPassThreshold: 0.65,
              maxRefineAttempts: 3,
            },
          ],
        },
      },
    });

    console.log(`   ✅ 系统工作流 Agent: ${systemAgent.id}`);
    console.log(`      workflow: ${workflow.id}, 4 steps (prd → visual_design → technical_doc? → page_code)`);
    created++;
  }

  console.log('');
  console.log(`🎉 完成! 新建 ${created} 条, 跳过 ${skipped} 条`);

  // 统计
  const [skillsCount, mcpsCount, agentsCount, videosCount, imagesCount] =
    await Promise.all([
      prisma.skills.count({ where: { status: 'APPROVED' } }),
      prisma.mcp_servers.count({ where: { status: 'APPROVED' } }),
      prisma.agents.count({ where: { status: 'APPROVED' } }),
      prisma.video_templates.count({ where: { status: 'APPROVED' } }),
      prisma.image_templates.count({ where: { status: 'APPROVED' } }),
    ]);
  console.log('');
  console.log('📊 已上架资源统计:');
  console.log(`   Skills:          ${skillsCount}`);
  console.log(`   MCP Servers:     ${mcpsCount}`);
  console.log(`   Agents:          ${agentsCount}`);
  console.log(`   Video Templates: ${videosCount}`);
  console.log(`   Image Templates: ${imagesCount}`);
}

main()
  .catch((err) => {
    console.error('❌ 种子脚本失败:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
