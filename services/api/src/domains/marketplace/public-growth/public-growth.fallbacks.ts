import {
  PublicCollectionKind,
  PublicCreationMediaType,
} from '../../platform/prisma/generated';
import type {
  PublicGrowthCollection,
  PublicGrowthFeature,
  PublicGrowthMediaItem,
  PublicGrowthPage,
} from './public-growth.types';

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=82`;

export const fallbackMediaItems: PublicGrowthMediaItem[] = [
  {
    id: 'demo-cinematic-room',
    title: 'Cinematic product room',
    subtitle: 'Image direction',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1557683316-973673baf926'),
    href: '/ai/image',
    badge: 'Prompt',
    tags: ['product', 'cinematic', 'studio'],
    author: null,
  },
  {
    id: 'demo-fashion-loop',
    title: 'Editorial motion loop',
    subtitle: 'Video concept',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1496747611176-843222e1e57c'),
    href: '/ai/video',
    badge: 'Video',
    tags: ['fashion', 'motion', 'campaign'],
    author: null,
  },
  {
    id: 'demo-brand-canvas',
    title: 'Brand canvas remix',
    subtitle: 'Template workflow',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1500530855697-b586d89ba3ee'),
    href: '/canvas',
    badge: 'Canvas',
    tags: ['canvas', 'layout', 'story'],
    author: null,
  },
  {
    id: 'demo-soul-cinema',
    title: 'Soul cinema portrait',
    subtitle: 'Community pick',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1500534314209-a25ddb2bd429'),
    href: '/community/soul-cinema',
    badge: 'Community',
    tags: ['portrait', 'cinema', 'mood'],
    author: null,
  },
  {
    id: 'demo-marketing-studio',
    title: 'Marketing studio batch',
    subtitle: 'Campaign system',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1522202176988-66273c2fd55f'),
    href: '/marketing-studio',
    badge: 'Batch',
    tags: ['marketing', 'ads', 'scale'],
    author: null,
  },
  {
    id: 'demo-original-series',
    title: 'Original series frame',
    subtitle: 'Serialized worlds',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1519608487953-e999c86e7455'),
    href: '/original-series',
    badge: 'Series',
    tags: ['series', 'world', 'story'],
    author: null,
  },
  {
    id: 'demo-product-poster',
    title: 'Neon product poster',
    subtitle: 'Ad-ready image set',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1526947425960-945c6e72858f'),
    href: '/ai/image',
    badge: 'Poster',
    tags: ['product', 'poster', 'ads'],
    author: null,
  },
  {
    id: 'demo-runway-motion',
    title: 'Runway motion frame',
    subtitle: 'Short-form visual hook',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1515886657613-9f3515b0c78f'),
    href: '/ai/video',
    badge: 'Motion',
    tags: ['fashion', 'video', 'launch'],
    author: null,
  },
  {
    id: 'demo-edit-board',
    title: 'Edit board system',
    subtitle: 'Canvas composition',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1518005020951-eccb494ad742'),
    href: '/canvas',
    badge: 'Edit',
    tags: ['canvas', 'remix', 'reference'],
    author: null,
  },
  {
    id: 'demo-founder-launch',
    title: 'Founder launch room',
    subtitle: 'Marketing angle',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1529333166437-7750a6dd5a70'),
    href: '/marketing-studio',
    badge: 'Growth',
    tags: ['brief', 'team', 'campaign'],
    author: null,
  },
  {
    id: 'demo-world-frame',
    title: 'Dream world frame',
    subtitle: 'Original series mood',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1500530855697-b586d89ba3ee'),
    href: '/original-series',
    badge: 'World',
    tags: ['series', 'cinema', 'story'],
    author: null,
  },
  {
    id: 'demo-systems-lab',
    title: 'Systems lab',
    subtitle: 'Supercomputer page',
    mediaType: PublicCreationMediaType.image,
    mediaUrl: image('photo-1518770660439-4636190af475'),
    href: '/supercomputer',
    badge: 'Engine',
    tags: ['systems', 'routing', 'scale'],
    author: null,
  },
];

export const fallbackFeatures: PublicGrowthFeature[] = [
  {
    key: 'nano-image',
    title: 'AI Image',
    description: 'Generate campaign-ready images with prompt, references, and edit control.',
    href: '/ai/image',
    badge: 'Nano',
    mediaUrl: image('photo-1497366754035-f200968a6e72'),
    accent: '#9ff5c7',
  },
  {
    key: 'seedance-video',
    title: 'AI Video',
    description: 'Turn scenes, products, and storyboards into short-form video projects.',
    href: '/ai/video',
    badge: 'Seedance',
    mediaUrl: image('photo-1516035069371-29a1b244cc32'),
    accent: '#7dd3fc',
  },
  {
    key: 'marketing-studio',
    title: 'Marketing Studio',
    description: 'Create repeatable ad variations, social cuts, and product launch sets.',
    href: '/marketing-studio',
    badge: 'Growth',
    mediaUrl: image('photo-1557804506-669a67965ba0'),
    accent: '#ffcf7a',
  },
  {
    key: 'canvas',
    title: 'Canvas',
    description: 'Compose, remix, and reuse visual systems across images and video.',
    href: '/canvas',
    badge: 'Edit',
    mediaUrl: image('photo-1497366216548-37526070297c'),
    accent: '#fca5a5',
  },
];

export const fallbackCollections: PublicGrowthCollection[] = [
  {
    slug: 'seedance',
    kind: PublicCollectionKind.COMMUNITY,
    title: 'Seedance Video',
    description: 'Fast video experiments, camera motion, and launch-ready reels.',
    heroMedia: image('photo-1516035069371-29a1b244cc32'),
    tags: ['video', 'motion', 'storyboard'],
  },
  {
    slug: 'marketing-studio',
    kind: PublicCollectionKind.COMMUNITY,
    title: 'Marketing Studio',
    description: 'Product ads, social hooks, comparison shots, and campaign systems.',
    heroMedia: image('photo-1557804506-669a67965ba0'),
    tags: ['ads', 'product', 'campaign'],
  },
  {
    slug: 'soul-cinema',
    kind: PublicCollectionKind.COMMUNITY,
    title: 'Soul Cinema',
    description: 'Cinematic portraits, moody scenes, and creator-led visual worlds.',
    heroMedia: image('photo-1519608487953-e999c86e7455'),
    tags: ['cinema', 'portrait', 'mood'],
  },
];

export const fallbackGrowthPages: PublicGrowthPage[] = [
  {
    slug: 'marketing-studio',
    eyebrow: 'Growth system',
    title: 'Marketing Studio',
    description: 'Build launch assets, ad variations, and reusable creative systems from one brief.',
    heroMedia: image('photo-1557804506-669a67965ba0'),
    ctaHref: '/ai/image',
    ctaLabel: 'Start a campaign',
    tags: ['Campaigns', 'Batch variants', 'Product ads'],
    sections: [
      {
        title: 'Brief to visual set',
        body: 'Turn product positioning, target audience, and offer into a full creative set.',
      },
      {
        title: 'Scale variations',
        body: 'Keep brand direction consistent while exploring hooks, scenes, and formats.',
      },
      {
        title: 'Publishable outputs',
        body: 'Move finished images and videos into public collections only after approval.',
      },
    ],
  },
  {
    slug: 'canvas',
    eyebrow: 'Creative workspace',
    title: 'Canvas',
    description: 'A composition surface for prompt-led edits, references, and reusable layout systems.',
    heroMedia: image('photo-1497366216548-37526070297c'),
    ctaHref: '/workbench/image',
    ctaLabel: 'Open canvas',
    tags: ['Compose', 'Remix', 'Reference'],
    sections: [
      {
        title: 'Prompt with context',
        body: 'Use source images, references, and edit instructions without losing the creative thread.',
      },
      {
        title: 'Iterate visibly',
        body: 'Keep generations, variants, and final assets close to the workbench.',
      },
    ],
  },
  {
    slug: 'original-series',
    eyebrow: 'Story worlds',
    title: 'Original Series',
    description: 'Package recurring characters, worlds, and episode-style collections for public discovery.',
    heroMedia: image('photo-1519608487953-e999c86e7455'),
    ctaHref: '/community',
    ctaLabel: 'Explore worlds',
    tags: ['Series', 'Characters', 'Collections'],
    sections: [
      {
        title: 'World-first pages',
        body: 'Create collection pages that make a visual universe easier to revisit and share.',
      },
      {
        title: 'Creator-led discovery',
        body: 'Connect public works back to creator profiles, prompts, and templates.',
      },
    ],
  },
  {
    slug: 'supercomputer',
    eyebrow: 'Generation engine',
    title: 'Supercomputer',
    description: 'A public-facing page for the speed, model routing, and production capacity behind Amux Studio.',
    heroMedia: image('photo-1518770660439-4636190af475'),
    ctaHref: '/pricing',
    ctaLabel: 'See plans',
    tags: ['Routing', 'Throughput', 'Reliability'],
    sections: [
      {
        title: 'Model-aware routing',
        body: 'Keep image, video, and language jobs aligned with the right generation stack.',
      },
      {
        title: 'Credit-aware production',
        body: 'Expose capacity and cost clearly through membership and points.',
      },
    ],
  },
  {
    slug: 'mcp',
    eyebrow: 'Tool ecosystem',
    title: 'MCP',
    description: 'Discover cloud and desktop tool integrations that extend Amux Studio workflows.',
    heroMedia: image('photo-1558494949-ef010cbdcc31'),
    ctaHref: '/marketplace/mcp',
    ctaLabel: 'Browse MCP servers',
    tags: ['Tools', 'Desktop', 'Automation'],
    sections: [
      {
        title: 'Marketplace ready',
        body: 'MCP resources stay in the existing marketplace while public pages explain use cases.',
      },
      {
        title: 'Runtime clarity',
        body: 'Surface whether a resource runs in cloud, desktop, or either before acquisition.',
      },
    ],
  },
];

export const fallbackTagRail = [
  { label: 'Marketing hooks', href: '/presets?tag=marketing' },
  { label: 'Product video', href: '/presets?tag=product' },
  { label: 'Cinematic portrait', href: '/presets?tag=cinema' },
  { label: 'Creator profile', href: '/community/soul-cinema' },
  { label: 'Canvas remix', href: '/canvas' },
  { label: 'MCP workflows', href: '/mcp' },
];

export interface PublicGrowthFallbackBundle {
  mediaItems: PublicGrowthMediaItem[];
  features: PublicGrowthFeature[];
  collections: PublicGrowthCollection[];
  growthPages: PublicGrowthPage[];
  tagRail: Array<{ label: string; href: string }>;
  homePromo: string;
  homeBanner: PublicGrowthFeature;
  labels: {
    startCreating: string;
    hotPreset: string;
    imagePreset: string;
    hotVideo: string;
    videoPreset: string;
  };
}

const englishFallbackBundle: PublicGrowthFallbackBundle = {
  mediaItems: fallbackMediaItems,
  features: fallbackFeatures,
  collections: fallbackCollections,
  growthPages: fallbackGrowthPages,
  tagRail: fallbackTagRail,
  homePromo: 'Launch credits are live: explore image, video, presets, and creator pages',
  homeBanner: {
    key: 'public-growth-banner',
    title: 'A public growth layer for every finished creation',
    description:
      'Keep work private by default, then publish approved images and videos into shareable pages, collections, profiles, and search-friendly detail views.',
    href: '/community',
    badge: 'Public beta',
    mediaUrl: fallbackMediaItems[2]?.mediaUrl,
    accent: '#9ff5c7',
  },
  labels: {
    startCreating: 'Start creating',
    hotPreset: 'Hot preset',
    imagePreset: 'Image preset',
    hotVideo: 'Hot video',
    videoPreset: 'Video preset',
  },
};

const zhCNFallbackBundle: PublicGrowthFallbackBundle = {
  mediaItems: [
    {
      id: 'demo-cinematic-room',
      title: '电影感产品空间',
      subtitle: '图片方向',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1557683316-973673baf926'),
      href: '/ai/image',
      badge: '提示词',
      tags: ['产品', '电影感', '影棚'],
      author: null,
    },
    {
      id: 'demo-fashion-loop',
      title: '编辑风动态循环',
      subtitle: '视频概念',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1496747611176-843222e1e57c'),
      href: '/ai/video',
      badge: '视频',
      tags: ['时尚', '动态', '活动'],
      author: null,
    },
    {
      id: 'demo-brand-canvas',
      title: '品牌画布 Remix',
      subtitle: '模板工作流',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1500530855697-b586d89ba3ee'),
      href: '/canvas',
      badge: '画布',
      tags: ['画布', '版式', '故事'],
      author: null,
    },
    {
      id: 'demo-soul-cinema',
      title: '灵魂电影人像',
      subtitle: '社区精选',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1500534314209-a25ddb2bd429'),
      href: '/community/soul-cinema',
      badge: '社区',
      tags: ['人像', '电影', '氛围'],
      author: null,
    },
    {
      id: 'demo-marketing-studio',
      title: '营销工作室批量素材',
      subtitle: '活动系统',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1522202176988-66273c2fd55f'),
      href: '/marketing-studio',
      badge: '批量',
      tags: ['营销', '广告', '规模化'],
      author: null,
    },
    {
      id: 'demo-original-series',
      title: '原创系列画面',
      subtitle: '连续故事世界',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1519608487953-e999c86e7455'),
      href: '/original-series',
      badge: '系列',
      tags: ['系列', '世界观', '故事'],
      author: null,
    },
    {
      id: 'demo-product-poster',
      title: '霓虹产品海报',
      subtitle: '可用于广告的图片组',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1526947425960-945c6e72858f'),
      href: '/ai/image',
      badge: '海报',
      tags: ['产品', '海报', '广告'],
      author: null,
    },
    {
      id: 'demo-runway-motion',
      title: '秀场动态画面',
      subtitle: '短视频视觉钩子',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1515886657613-9f3515b0c78f'),
      href: '/ai/video',
      badge: '动态',
      tags: ['时尚', '视频', '发布'],
      author: null,
    },
    {
      id: 'demo-edit-board',
      title: '编辑看板系统',
      subtitle: '画布组合',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1518005020951-eccb494ad742'),
      href: '/canvas',
      badge: '编辑',
      tags: ['画布', 'Remix', '参考'],
      author: null,
    },
    {
      id: 'demo-founder-launch',
      title: '创始人发布空间',
      subtitle: '营销角度',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1529333166437-7750a6dd5a70'),
      href: '/marketing-studio',
      badge: '增长',
      tags: ['brief', '团队', '活动'],
      author: null,
    },
    {
      id: 'demo-world-frame',
      title: '梦境世界画面',
      subtitle: '原创系列氛围',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1500530855697-b586d89ba3ee'),
      href: '/original-series',
      badge: '世界',
      tags: ['系列', '电影', '故事'],
      author: null,
    },
    {
      id: 'demo-systems-lab',
      title: '系统实验室',
      subtitle: 'Supercomputer 页面',
      mediaType: PublicCreationMediaType.image,
      mediaUrl: image('photo-1518770660439-4636190af475'),
      href: '/supercomputer',
      badge: '引擎',
      tags: ['系统', '路由', '规模化'],
      author: null,
    },
  ],
  features: [
    {
      key: 'nano-image',
      title: 'AI 图片',
      description: '用提示词、参考图和编辑控制生成可用于活动的图片。',
      href: '/ai/image',
      badge: 'Nano',
      mediaUrl: image('photo-1497366754035-f200968a6e72'),
      accent: '#9ff5c7',
    },
    {
      key: 'seedance-video',
      title: 'AI 视频',
      description: '把场景、产品和分镜转成适合短视频传播的视频项目。',
      href: '/ai/video',
      badge: 'Seedance',
      mediaUrl: image('photo-1516035069371-29a1b244cc32'),
      accent: '#7dd3fc',
    },
    {
      key: 'marketing-studio',
      title: '营销工作室',
      description: '从一份 brief 生成广告变体、社交切片和产品发布素材。',
      href: '/marketing-studio',
      badge: '增长',
      mediaUrl: image('photo-1557804506-669a67965ba0'),
      accent: '#ffcf7a',
    },
    {
      key: 'canvas',
      title: '画布',
      description: '在图片和视频之间组合、Remix 并复用视觉系统。',
      href: '/canvas',
      badge: '编辑',
      mediaUrl: image('photo-1497366216548-37526070297c'),
      accent: '#fca5a5',
    },
  ],
  collections: [
    {
      slug: 'seedance',
      kind: PublicCollectionKind.COMMUNITY,
      title: 'Seedance 视频',
      description: '快速视频实验、镜头运动和发布可用的短片。',
      heroMedia: image('photo-1516035069371-29a1b244cc32'),
      tags: ['视频', '动态', '分镜'],
    },
    {
      slug: 'marketing-studio',
      kind: PublicCollectionKind.COMMUNITY,
      title: '营销工作室',
      description: '产品广告、社交钩子、对比图和活动素材系统。',
      heroMedia: image('photo-1557804506-669a67965ba0'),
      tags: ['广告', '产品', '活动'],
    },
    {
      slug: 'soul-cinema',
      kind: PublicCollectionKind.COMMUNITY,
      title: '灵魂电影',
      description: '电影感人像、氛围场景和创作者主导的视觉世界。',
      heroMedia: image('photo-1519608487953-e999c86e7455'),
      tags: ['电影', '人像', '氛围'],
    },
  ],
  growthPages: [
    {
      slug: 'marketing-studio',
      eyebrow: '增长系统',
      title: '营销工作室',
      description: '从一份 brief 构建发布素材、广告变体和可复用创意系统。',
      heroMedia: image('photo-1557804506-669a67965ba0'),
      ctaHref: '/ai/image',
      ctaLabel: '开始活动创作',
      tags: ['活动', '批量变体', '产品广告'],
      sections: [
        { title: '从 brief 到视觉套组', body: '把产品定位、目标人群和优惠信息转成完整创意套组。' },
        { title: '规模化变体', body: '在保持品牌方向一致的同时探索钩子、场景和格式。' },
        { title: '可发布产物', body: '完成的图片和视频只在审核确认后进入公开集合。' },
      ],
    },
    {
      slug: 'canvas',
      eyebrow: '创意工作区',
      title: '画布',
      description: '用于提示词编辑、参考图和可复用版式系统的组合空间。',
      heroMedia: image('photo-1497366216548-37526070297c'),
      ctaHref: '/workbench/image',
      ctaLabel: '打开画布',
      tags: ['组合', 'Remix', '参考'],
      sections: [
        { title: '带上下文提示', body: '使用源图、参考和编辑说明，同时保留创作脉络。' },
        { title: '可见地迭代', body: '让生成、变体和最终素材都贴近工作台。' },
      ],
    },
    {
      slug: 'original-series',
      eyebrow: '故事世界',
      title: '原创系列',
      description: '把反复出现的角色、世界观和剧集式集合打包成公开发现入口。',
      heroMedia: image('photo-1519608487953-e999c86e7455'),
      ctaHref: '/community',
      ctaLabel: '探索世界',
      tags: ['系列', '角色', '集合'],
      sections: [
        { title: '世界观优先页面', body: '创建集合页，让一个视觉宇宙更容易被回访和分享。' },
        { title: '创作者驱动发现', body: '把公开作品连接回创作者主页、提示词和模板。' },
      ],
    },
    {
      slug: 'supercomputer',
      eyebrow: '生成引擎',
      title: 'Supercomputer',
      description: '面向外部说明 Amux Studio 背后的速度、模型路由和生产容量。',
      heroMedia: image('photo-1518770660439-4636190af475'),
      ctaHref: '/pricing',
      ctaLabel: '查看套餐',
      tags: ['路由', '吞吐', '可靠性'],
      sections: [
        { title: '感知模型的路由', body: '让图片、视频和语言任务匹配合适的生成栈。' },
        { title: '感知积分的生产', body: '通过会员和积分清晰呈现容量与成本。' },
      ],
    },
    {
      slug: 'mcp',
      eyebrow: '工具生态',
      title: 'MCP',
      description: '发现能扩展 Amux Studio 工作流的云端和桌面工具集成。',
      heroMedia: image('photo-1558494949-ef010cbdcc31'),
      ctaHref: '/marketplace/mcp',
      ctaLabel: '浏览 MCP 服务',
      tags: ['工具', '桌面端', '自动化'],
      sections: [
        { title: '接入 Marketplace', body: 'MCP 资源保留在现有 Marketplace，公开页负责解释使用场景。' },
        { title: '运行时清晰', body: '在获取前说明资源运行在云端、桌面端还是两者皆可。' },
      ],
    },
  ],
  tagRail: [
    { label: '营销钩子', href: '/presets?tag=marketing' },
    { label: '产品视频', href: '/presets?tag=product' },
    { label: '电影感人像', href: '/presets?tag=cinema' },
    { label: '创作者主页', href: '/community/soul-cinema' },
    { label: '画布 Remix', href: '/canvas' },
    { label: 'MCP 工作流', href: '/mcp' },
  ],
  homePromo: '发布积分已上线：探索图片、视频、预设和创作者页面',
  homeBanner: {
    key: 'public-growth-banner',
    title: '为每个完成作品准备公开增长层',
    description: '默认保持私有，只把创作者确认发布的图片和视频进入分享页、集合、主页和搜索友好的详情页。',
    href: '/community',
    badge: '公开 Beta',
    mediaUrl: image('photo-1557804506-669a67965ba0'),
    accent: '#9ff5c7',
  },
  labels: {
    startCreating: '开始创作',
    hotPreset: '热门预设',
    imagePreset: '图片预设',
    hotVideo: '热门视频',
    videoPreset: '视频预设',
  },
};

function toTraditional(value: string): string {
  return value
    .replace(/图片/g, '圖片')
    .replace(/视频/g, '影片')
    .replace(/预设/g, '預設')
    .replace(/海报/g, '海報')
    .replace(/时尚/g, '時尚')
    .replace(/创作/g, '創作')
    .replace(/创意/g, '創意')
    .replace(/创作者/g, '創作者')
    .replace(/创始人/g, '創辦人')
    .replace(/创建/g, '建立')
    .replace(/发布/g, '發布')
    .replace(/公开/g, '公開')
    .replace(/默认/g, '預設')
    .replace(/搜索/g, '搜尋')
    .replace(/详情/g, '詳情')
    .replace(/主页/g, '主頁')
    .replace(/社区/g, '社群')
    .replace(/精选/g, '精選')
    .replace(/电影/g, '電影')
    .replace(/动态/g, '動態')
    .replace(/编辑/g, '編輯')
    .replace(/模板/g, '範本')
    .replace(/营销/g, '行銷')
    .replace(/批量/g, '批次')
    .replace(/活动/g, '活動')
    .replace(/产品/g, '產品')
    .replace(/广告/g, '廣告')
    .replace(/画布/g, '畫布')
    .replace(/原创/g, '原創')
    .replace(/连续/g, '連續')
    .replace(/团队/g, '團隊')
    .replace(/系统/g, '系統')
    .replace(/实验室/g, '實驗室')
    .replace(/梦境/g, '夢境')
    .replace(/世界观/g, '世界觀')
    .replace(/工作区/g, '工作區')
    .replace(/增长/g, '增長')
    .replace(/准备/g, '準備')
    .replace(/积分/g, '點數')
    .replace(/上线/g, '上線')
    .replace(/完成/g, '完成')
    .replace(/集合/g, '集合')
    .replace(/提示词/g, '提示詞')
    .replace(/参考图/g, '參考圖')
    .replace(/复用/g, '重用')
    .replace(/说明/g, '說明')
    .replace(/容量/g, '容量')
    .replace(/云端/g, '雲端')
    .replace(/集成/g, '整合')
    .replace(/套餐/g, '方案')
    .replace(/浏览/g, '瀏覽')
    .replace(/热门/g, '熱門');
}

function toTraditionalOptional(value?: string | null): string | undefined {
  return value ? toTraditional(value) : undefined;
}

const zhTWFallbackBundle: PublicGrowthFallbackBundle = {
  ...zhCNFallbackBundle,
  mediaItems: zhCNFallbackBundle.mediaItems.map((item) => ({
    ...item,
    title: toTraditional(item.title),
    subtitle: toTraditionalOptional(item.subtitle),
    badge: toTraditionalOptional(item.badge),
    tags: item.tags.map(toTraditional),
  })),
  features: zhCNFallbackBundle.features.map((feature) => ({
    ...feature,
    title: toTraditional(feature.title),
    description: toTraditional(feature.description),
    badge: toTraditionalOptional(feature.badge),
  })),
  collections: zhCNFallbackBundle.collections.map((collection) => ({
    ...collection,
    title: toTraditional(collection.title),
    description: toTraditionalOptional(collection.description),
    tags: collection.tags.map(toTraditional),
  })),
  growthPages: zhCNFallbackBundle.growthPages.map((page) => ({
    ...page,
    eyebrow: toTraditionalOptional(page.eyebrow),
    title: toTraditional(page.title),
    description: toTraditional(page.description),
    ctaLabel: toTraditionalOptional(page.ctaLabel),
    tags: page.tags.map(toTraditional),
    sections: page.sections.map((section) => ({
      ...section,
      title: toTraditional(section.title),
      body: toTraditional(section.body),
    })),
  })),
  tagRail: zhCNFallbackBundle.tagRail.map((item) => ({
    ...item,
    label: toTraditional(item.label),
  })),
  homePromo: toTraditional(zhCNFallbackBundle.homePromo),
  homeBanner: {
    ...zhCNFallbackBundle.homeBanner,
    title: toTraditional(zhCNFallbackBundle.homeBanner.title),
    description: toTraditional(zhCNFallbackBundle.homeBanner.description),
    badge: toTraditionalOptional(zhCNFallbackBundle.homeBanner.badge),
  },
  labels: {
    startCreating: toTraditional(zhCNFallbackBundle.labels.startCreating),
    hotPreset: toTraditional(zhCNFallbackBundle.labels.hotPreset),
    imagePreset: toTraditional(zhCNFallbackBundle.labels.imagePreset),
    hotVideo: toTraditional(zhCNFallbackBundle.labels.hotVideo),
    videoPreset: toTraditional(zhCNFallbackBundle.labels.videoPreset),
  },
};

export function getPublicGrowthFallbacks(locale?: string): PublicGrowthFallbackBundle {
  const normalized = locale?.toLowerCase();
  if (normalized?.startsWith('zh-tw') || normalized?.startsWith('zh-hk')) {
    return zhTWFallbackBundle;
  }
  if (normalized?.startsWith('zh')) {
    return zhCNFallbackBundle;
  }
  return englishFallbackBundle;
}
