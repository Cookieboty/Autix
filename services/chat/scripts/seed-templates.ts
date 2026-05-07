#!/usr/bin/env bun
/**
 * 模板市场测试数据种子脚本
 * 用法: bun run --filter=@autix/chat seed:templates （从根目录注入 .env）
 * 环境变量: CHAT_DATABASE_URL
 *          AUTHOR_ID (可选，默认用 "seed-author")
 */

import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.CHAT_DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const AUTHOR_ID = process.env.AUTHOR_ID || 'seed-author';

// ── Unsplash 图片 (CC 授权，直链格式) ──────────────────────────────────────

const img = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format`;

const IMAGES = {
  portrait: {
    cover: [
      img('photo-1534528741775-53994a69daeb'),
      img('photo-1507003211169-0a1dd7228f2d'),
      img('photo-1531746020798-e6953c6e8e04'),
      img('photo-1544005313-94ddf0286df2'),
    ],
    examples: [
      img('photo-1517841905240-472988babdf9'),
      img('photo-1494790108377-be9c29b29330'),
      img('photo-1438761681033-6461ffad8d80'),
      img('photo-1524504388940-b1c1722653e1'),
      img('photo-1552058544-f2b08422138a'),
      img('photo-1506794778202-cad84cf45f1d'),
    ],
  },
  landscape: {
    cover: [
      img('photo-1506905925346-21bda4d32df4'),
      img('photo-1470071459604-3b5ec3a7fe05'),
      img('photo-1501854140801-50d01698950b'),
      img('photo-1472214103451-9374bd1c798e'),
    ],
    examples: [
      img('photo-1433086966358-54859d0ed716'),
      img('photo-1469474968028-56623f02e42e'),
      img('photo-1465056836900-8f1e940b3fc8'),
      img('photo-1464822759023-fed622ff2c3b'),
      img('photo-1540979388789-6cee28a1cdc9'),
    ],
  },
  product: {
    cover: [
      img('photo-1523275335684-37898b6baf30'),
      img('photo-1505740420928-5e560c06d30e'),
      img('photo-1542291026-7eec264c27ff'),
      img('photo-1526170375885-4d8ecf77b99f'),
    ],
    examples: [
      img('photo-1560343090-f0409e92791a'),
      img('photo-1572635196237-14b3f281503f'),
      img('photo-1585386959984-a4155224a1ad'),
      img('photo-1491553895911-0055eca6402d'),
    ],
  },
  illustration: {
    cover: [
      img('photo-1618005182384-a83a8bd57fbe'),
      img('photo-1634017839464-5c339ebe3cb4'),
      img('photo-1614851099511-773084f6911d'),
      img('photo-1578301978693-85fa9c0320b9'),
    ],
    examples: [
      img('photo-1549490349-8643362247b5'),
      img('photo-1543857778-c4a1a3e0b2eb'),
      img('photo-1553356084-58ef4a67b2a7'),
      img('photo-1567095761054-7a02e69e5b43'),
    ],
  },
  architecture: {
    cover: [
      img('photo-1431576901776-e539bd916ba2'),
      img('photo-1487958449943-2429e8be8625'),
      img('photo-1486325212027-8081e485255e'),
      img('photo-1448630360428-65456885c650'),
    ],
    examples: [
      img('photo-1479839672679-a46483c0e7c8'),
      img('photo-1511818966892-d7d671e672a2'),
      img('photo-1494526585095-c41746248156'),
      img('photo-1545558014-8692077e9b5c'),
    ],
  },
  scifi: {
    cover: [
      img('photo-1451187580459-43490279c0fa'),
      img('photo-1446776811953-b23d57bd21aa'),
      img('photo-1462331940025-496dfbfc7564'),
      img('photo-1581822261290-991b38693d1b'),
    ],
    examples: [
      img('photo-1419242902214-272b3f66ee7a'),
      img('photo-1516339901601-2e1b62dc0c45'),
      img('photo-1534996858221-380b92700493'),
      img('photo-1614728263785-a6ce73eab0eb'),
    ],
  },
  scene: {
    cover: [
      img('photo-1519681393784-d120267933ba'),
      img('photo-1507525428034-b723cf961d3e'),
      img('photo-1476514525535-07fb3b4ae5f1'),
      img('photo-1504701954957-2010ec3bcec1'),
    ],
    examples: [
      img('photo-1490750967868-88aa4f44baee'),
      img('photo-1505832018823-50331d70d237'),
      img('photo-1505765050516-f72dcac9c60e'),
      img('photo-1414609245224-afa02bfb3fda'),
    ],
  },
};

// ── 模板数据 ────────────────────────────────────────────────────────────────

interface TemplateData {
  title: string;
  description: string;
  category: string;
  prompt: string;
  variables: Array<{
    key: string;
    label: string;
    type: string;
    default?: string;
    options?: string[];
  }>;
  coverImage: string;
  exampleImages: string[];
  modelHint: string;
  tags: string[];
  useCount: number;
  likeCount: number;
}

const templates: TemplateData[] = [
  // ━━━━━━━━━━━━ 人像 ━━━━━━━━━━━━
  {
    title: '电影级人像写真',
    description:
      '生成具有电影感光影效果的人像照片，适合高端写真、社交媒体头像和艺术摄影场景。支持自定义光照氛围和情绪风格。',
    category: '人像',
    prompt: `A cinematic portrait of a {{gender}}, {{age_range}} years old, with {{expression}} expression. Shot in {{lighting}} lighting, {{color_tone}} color grading. The subject is positioned with a {{composition}} composition against a {{background}} background. Ultra-high resolution, 85mm lens, shallow depth of field, film grain texture. Professional fashion photography quality.`,
    variables: [
      { key: 'gender', label: '性别', type: 'select', default: '女性', options: ['女性', '男性'] },
      { key: 'age_range', label: '年龄段', type: 'text', default: '25-30' },
      { key: 'expression', label: '表情', type: 'select', default: 'serene', options: ['serene', 'confident', 'joyful', 'mysterious', 'contemplative'] },
      { key: 'lighting', label: '光线', type: 'select', default: 'golden hour', options: ['golden hour', 'Rembrandt', 'butterfly', 'split', 'neon'] },
      { key: 'color_tone', label: '色调', type: 'select', default: 'warm cinematic', options: ['warm cinematic', 'cold blue', 'vintage film', 'high contrast B&W', 'pastel'] },
      { key: 'composition', label: '构图', type: 'select', default: 'rule of thirds', options: ['rule of thirds', 'centered', 'close-up', 'three-quarter'] },
      { key: 'background', label: '背景', type: 'text', default: 'blurred urban cityscape at dusk' },
    ],
    coverImage: IMAGES.portrait.cover[0],
    exampleImages: IMAGES.portrait.examples.slice(0, 3),
    modelHint: 'gpt-image-2',
    tags: ['人像', '电影感', '写真', '艺术摄影'],
    useCount: 342,
    likeCount: 128,
  },
  {
    title: '赛博朋克数字肖像',
    description:
      '融合赛博朋克美学的未来主义人像，霓虹灯光、机械增强元素与人物融为一体。适合游戏角色设计、科幻插画封面。',
    category: '人像',
    prompt: `A cyberpunk digital portrait of a {{gender}} character with {{augmentation}} cybernetic augmentations. Neon {{neon_color}} lighting reflects off wet surfaces. The subject wears {{outfit}} clothing, with {{hair_style}} hair. Background features a {{setting}} cyberpunk environment. Style: hyper-detailed digital art, 8K resolution, volumetric lighting, ray-traced reflections. Inspired by Blade Runner and Ghost in the Shell aesthetics.`,
    variables: [
      { key: 'gender', label: '性别', type: 'select', default: '女性', options: ['女性', '男性', '中性'] },
      { key: 'augmentation', label: '增强元素', type: 'text', default: 'glowing eye implants and metallic jaw plate' },
      { key: 'neon_color', label: '霓虹色', type: 'select', default: 'pink and cyan', options: ['pink and cyan', 'purple and orange', 'green and blue', 'red and white'] },
      { key: 'outfit', label: '服装', type: 'text', default: 'high-collar techwear jacket with LED-trimmed collar' },
      { key: 'hair_style', label: '发型', type: 'text', default: 'asymmetric bob with fiber-optic highlights' },
      { key: 'setting', label: '场景', type: 'text', default: 'rain-soaked alleyway with holographic advertisements' },
    ],
    coverImage: IMAGES.portrait.cover[1],
    exampleImages: IMAGES.portrait.examples.slice(2, 5),
    modelHint: 'gpt-image-2',
    tags: ['赛博朋克', '数字艺术', '未来主义', '角色设计'],
    useCount: 516,
    likeCount: 247,
  },
  {
    title: '水彩风格人物插画',
    description:
      '将人像转化为精致的水彩画风格插画，保留人物特征的同时赋予柔和、梦幻的艺术质感。适合个人头像、书籍封面插图。',
    category: '人像',
    prompt: `A beautiful watercolor illustration of a {{subject}} with {{feature}} features. Painted in {{palette}} watercolor palette with visible brush strokes and natural pigment bleeding. The style combines {{art_influence}} influences. Paper texture visible, white space preserved artistically. {{mood}} atmosphere. High-quality scan of an original watercolor painting.`,
    variables: [
      { key: 'subject', label: '主体', type: 'text', default: 'young woman with flowing hair' },
      { key: 'feature', label: '面部特征', type: 'text', default: 'soft, delicate' },
      { key: 'palette', label: '配色', type: 'select', default: 'warm earth tones', options: ['warm earth tones', 'cool ocean blues', 'spring pastels', 'autumn golds', 'monochrome indigo'] },
      { key: 'art_influence', label: '艺术风格', type: 'text', default: 'Japanese ukiyo-e and modern fashion illustration' },
      { key: 'mood', label: '氛围', type: 'select', default: 'dreamy and ethereal', options: ['dreamy and ethereal', 'vibrant and energetic', 'melancholic and introspective', 'warm and inviting'] },
    ],
    coverImage: IMAGES.portrait.cover[2],
    exampleImages: IMAGES.portrait.examples.slice(3, 6),
    modelHint: 'gpt-image-2',
    tags: ['水彩', '插画', '艺术', '人物画'],
    useCount: 203,
    likeCount: 95,
  },

  // ━━━━━━━━━━━━ 风景 ━━━━━━━━━━━━
  {
    title: '史诗级自然风光',
    description:
      '生成令人叹为观止的自然风景摄影作品，涵盖雪山、森林、海洋等壮丽景观。适合壁纸、海报、旅行宣传素材。',
    category: '风景',
    prompt: `An epic landscape photograph of {{location_type}}, captured during {{time_of_day}}. The scene features {{weather}} weather conditions with {{sky}} sky. Shot with a {{lens}} lens, the composition emphasizes {{focal_point}} as the main subject. Color palette dominated by {{colors}}. Ultra-wide panoramic view, 8K resolution, HDR processing. National Geographic quality.`,
    variables: [
      { key: 'location_type', label: '地点类型', type: 'select', default: 'snow-capped mountain range with alpine lakes', options: ['snow-capped mountain range with alpine lakes', 'ancient forest with moss-covered redwoods', 'dramatic coastal cliffs with crashing waves', 'vast desert with sand dunes', 'volcanic landscape with lava flows'] },
      { key: 'time_of_day', label: '时间', type: 'select', default: 'golden hour sunrise', options: ['golden hour sunrise', 'blue hour twilight', 'midday harsh sun', 'stormy afternoon', 'midnight aurora'] },
      { key: 'weather', label: '天气', type: 'select', default: 'clear with wispy clouds', options: ['clear with wispy clouds', 'dramatic storm clouds', 'misty and foggy', 'light rain with rainbow', 'snow falling'] },
      { key: 'sky', label: '天空', type: 'text', default: 'vibrant orange and purple gradient' },
      { key: 'lens', label: '镜头', type: 'select', default: '16mm ultra-wide', options: ['16mm ultra-wide', '24mm wide-angle', '35mm standard', '50mm normal', '70-200mm telephoto'] },
      { key: 'focal_point', label: '焦点', type: 'text', default: 'a lone tree silhouetted against the sky' },
      { key: 'colors', label: '主色调', type: 'text', default: 'warm amber, deep blue, and emerald green' },
    ],
    coverImage: IMAGES.landscape.cover[0],
    exampleImages: IMAGES.landscape.examples.slice(0, 3),
    modelHint: 'gpt-image-2',
    tags: ['风景', '自然', '壁纸', '摄影'],
    useCount: 891,
    likeCount: 456,
  },
  {
    title: '东方山水意境画',
    description:
      '融合中国传统山水画意境的数字创作，水墨渲染与现代构图相结合，呈现诗意的东方美学。适合中式装饰、文化项目。',
    category: '风景',
    prompt: `A traditional Chinese ink wash landscape painting depicting {{scene}}. Rendered in {{ink_style}} style with {{color_treatment}} color treatment. The composition follows {{principle}} composition principles. {{elements}} are scattered throughout the scene. Calligraphic brush strokes define the mountains and water. Xuan paper texture, seal stamp in corner. {{atmosphere}} atmosphere pervades the entire work.`,
    variables: [
      { key: 'scene', label: '场景', type: 'text', default: 'misty mountains above a winding river with fishing boats' },
      { key: 'ink_style', label: '水墨风格', type: 'select', default: '泼墨写意 (splash ink freehand)', options: ['泼墨写意 (splash ink freehand)', '工笔细描 (meticulous detail)', '兼工带写 (mixed technique)', '没骨 (boneless wash)'] },
      { key: 'color_treatment', label: '着色', type: 'select', default: 'subtle cyan and earth tones', options: ['subtle cyan and earth tones', 'pure monochrome ink', 'rich blue-green (青绿山水)', 'light crimson (浅绛山水)'] },
      { key: 'principle', label: '构图', type: 'select', default: '高远 (looking up from below)', options: ['高远 (looking up from below)', '深远 (receding into distance)', '平远 (vast horizontal expanse)'] },
      { key: 'elements', label: '点缀元素', type: 'text', default: 'pine trees, a pavilion, and flying cranes' },
      { key: 'atmosphere', label: '意境', type: 'select', default: '空灵静谧 (ethereal serenity)', options: ['空灵静谧 (ethereal serenity)', '雄浑壮阔 (grand magnificence)', '萧瑟孤寂 (solitary desolation)', '春意盎然 (spring vitality)'] },
    ],
    coverImage: IMAGES.landscape.cover[1],
    exampleImages: IMAGES.landscape.examples.slice(2, 5),
    modelHint: 'gpt-image-2',
    tags: ['山水画', '中国风', '水墨', '东方美学'],
    useCount: 267,
    likeCount: 189,
  },
  {
    title: '梦幻极光星空',
    description:
      '捕捉北极光与浩瀚星空交织的壮丽夜景。星轨、银河与极光共同构成视觉盛宴。适合天文爱好者、壁纸素材。',
    category: '风景',
    prompt: `A breathtaking night sky photograph featuring {{aurora_type}} aurora borealis dancing above {{foreground}}. The aurora displays {{aurora_colors}} colors in sweeping curtain formations. The Milky Way galaxy is visible {{milky_way_position}}. {{star_effect}} stars dot the sky. The scene is reflected in {{reflection}}. Shot with a {{exposure}} exposure, ISO 3200, f/1.4. Astrophotography quality.`,
    variables: [
      { key: 'aurora_type', label: '极光类型', type: 'select', default: 'vivid and active', options: ['vivid and active', 'subtle and gentle', 'corona (overhead explosion)', 'pulsating waves'] },
      { key: 'foreground', label: '前景', type: 'text', default: 'a frozen lake surrounded by snow-covered pines' },
      { key: 'aurora_colors', label: '极光色彩', type: 'select', default: 'emerald green and violet', options: ['emerald green and violet', 'pink and cyan', 'deep red and green', 'multicolor spectrum'] },
      { key: 'milky_way_position', label: '银河位置', type: 'select', default: 'arching across the sky', options: ['arching across the sky', 'rising from the horizon', 'directly overhead', 'partially obscured by aurora'] },
      { key: 'star_effect', label: '星星效果', type: 'select', default: 'Sharp pinpoint', options: ['Sharp pinpoint', 'Star trail circles', 'Meteor shower streaks', 'Twinkling soft glow'] },
      { key: 'reflection', label: '倒影', type: 'text', default: 'a perfectly still lake creating a mirror image' },
      { key: 'exposure', label: '曝光', type: 'select', default: '15-second long', options: ['15-second long', '30-second extended', '5-second short', 'stacked composite'] },
    ],
    coverImage: IMAGES.landscape.cover[2],
    exampleImages: [IMAGES.landscape.examples[0], IMAGES.landscape.examples[4], IMAGES.scifi.examples[0]],
    modelHint: 'gpt-image-2',
    tags: ['极光', '星空', '夜景', '天文摄影'],
    useCount: 723,
    likeCount: 389,
  },

  // ━━━━━━━━━━━━ 产品 ━━━━━━━━━━━━
  {
    title: '高端产品广告摄影',
    description:
      '为产品创建专业级广告摄影效果，精准控制光影、材质反射和构图。适合电商主图、品牌宣传、社交媒体广告。',
    category: '产品',
    prompt: `Professional product photography of a {{product}} on a {{surface}} surface. Studio lighting setup: {{lighting_setup}}. Background is {{background}} with {{background_effect}} effect. The product features {{material}} material with {{finish}} finish that reflects light beautifully. Camera angle: {{angle}}. Styling includes {{props}} as complementary props. Shot on Phase One 150MP, 120mm macro lens, focus stacking for edge-to-edge sharpness. Commercial advertising quality.`,
    variables: [
      { key: 'product', label: '产品', type: 'text', default: 'premium mechanical watch with leather strap' },
      { key: 'surface', label: '承载面', type: 'select', default: 'polished black marble', options: ['polished black marble', 'raw concrete slab', 'brushed aluminum', 'natural wood grain', 'white acrylic'] },
      { key: 'lighting_setup', label: '灯光', type: 'select', default: 'key light with rim lighting', options: ['key light with rim lighting', 'soft diffused overhead', 'dramatic side lighting', 'backlit silhouette', 'natural window light'] },
      { key: 'background', label: '背景', type: 'select', default: 'gradient dark to light', options: ['gradient dark to light', 'pure white seamless', 'deep black void', 'textured fabric', 'blurred lifestyle scene'] },
      { key: 'background_effect', label: '背景效果', type: 'select', default: 'subtle bokeh', options: ['subtle bokeh', 'color gel splash', 'smoke wisps', 'water droplets', 'clean minimal'] },
      { key: 'material', label: '材质', type: 'text', default: 'brushed stainless steel and sapphire crystal' },
      { key: 'finish', label: '表面处理', type: 'select', default: 'high polish', options: ['high polish', 'matte', 'satin', 'textured', 'frosted'] },
      { key: 'angle', label: '拍摄角度', type: 'select', default: '45-degree hero shot', options: ['45-degree hero shot', 'flat lay top-down', 'eye-level straight on', 'low angle dramatic', 'macro detail close-up'] },
      { key: 'props', label: '道具', type: 'text', default: 'subtle water droplets and soft fabric drape' },
    ],
    coverImage: IMAGES.product.cover[0],
    exampleImages: IMAGES.product.examples.slice(0, 3),
    modelHint: 'gpt-image-2',
    tags: ['产品摄影', '商业', '广告', '电商'],
    useCount: 654,
    likeCount: 278,
  },
  {
    title: '美食摄影模板',
    description:
      '创建让人垂涎欲滴的美食摄影作品，精准控制食物质感、色彩还原和摆盘风格。适合餐饮品牌、菜单设计、美食博客。',
    category: '产品',
    prompt: `Appetizing food photography of {{dish}} beautifully plated on {{tableware}}. The dish features {{garnish}} garnish. Lighting: {{lighting}} creating {{shadow}} shadows. Surrounding props include {{props}}. Color palette emphasizes {{colors}}. Shot from {{angle}} angle. The food has {{texture}} texture with {{steam_effect}} steam effect. Shallow depth of field, high-resolution food photography, editorial magazine quality.`,
    variables: [
      { key: 'dish', label: '菜品', type: 'text', default: 'pan-seared salmon fillet with herb butter sauce' },
      { key: 'tableware', label: '餐具', type: 'text', default: 'handmade ceramic plate with organic edges' },
      { key: 'garnish', label: '装饰', type: 'text', default: 'microgreens, edible flowers, and citrus zest' },
      { key: 'lighting', label: '光线', type: 'select', default: 'soft natural side light', options: ['soft natural side light', 'warm overhead light', 'dramatic backlight', 'moody candlelight'] },
      { key: 'shadow', label: '阴影', type: 'select', default: 'soft and diffused', options: ['soft and diffused', 'harsh and defined', 'dappled through leaves', 'minimal flat'] },
      { key: 'props', label: '道具', type: 'text', default: 'linen napkin, vintage cutlery, fresh herbs' },
      { key: 'colors', label: '色彩', type: 'text', default: 'warm golden tones with fresh green accents' },
      { key: 'angle', label: '角度', type: 'select', default: '45-degree', options: ['45-degree', 'flat lay overhead', 'eye-level', 'low angle with depth'] },
      { key: 'texture', label: '质感', type: 'select', default: 'crispy golden crust with juicy interior', options: ['crispy golden crust with juicy interior', 'smooth and glossy', 'rustic and homestyle', 'deconstructed artistic'] },
      { key: 'steam_effect', label: '蒸汽', type: 'select', default: 'gentle wisps of rising steam', options: ['gentle wisps of rising steam', 'dramatic billowing steam', 'no visible steam', 'frost and cold mist'] },
    ],
    coverImage: IMAGES.product.cover[1],
    exampleImages: IMAGES.product.examples.slice(1, 4),
    modelHint: 'gpt-image-2',
    tags: ['美食', '摄影', '餐饮', '商业'],
    useCount: 432,
    likeCount: 201,
  },
  {
    title: '3D 产品渲染',
    description:
      '生成逼真的 3D 产品渲染效果图，适合产品概念设计、工业设计展示、众筹页面的高质量产品展示。',
    category: '产品',
    prompt: `Photorealistic 3D render of a {{product}} floating in {{environment}} environment. Material: {{material}} with {{surface}} surface quality. Lighting consists of {{lighting}} setup creating {{reflection}} reflections. The render uses {{style}} style with {{post_processing}} post-processing. Octane Render quality, 4K resolution, physically accurate materials and lighting.`,
    variables: [
      { key: 'product', label: '产品', type: 'text', default: 'wireless noise-cancelling headphones' },
      { key: 'environment', label: '环境', type: 'select', default: 'abstract gradient void', options: ['abstract gradient void', 'studio white cyclorama', 'lifestyle room setting', 'outdoor nature', 'futuristic tech space'] },
      { key: 'material', label: '材质', type: 'text', default: 'matte soft-touch plastic with aluminum accents' },
      { key: 'surface', label: '表面', type: 'select', default: 'pristine and flawless', options: ['pristine and flawless', 'slightly worn and used', 'with water droplets', 'frosted translucent'] },
      { key: 'lighting', label: '灯光', type: 'select', default: 'three-point HDRI', options: ['three-point HDRI', 'single dramatic spotlight', 'soft ambient', 'neon accent'] },
      { key: 'reflection', label: '反射', type: 'select', default: 'subtle environment', options: ['subtle environment', 'mirror-like', 'diffused matte', 'colored gradient'] },
      { key: 'style', label: '风格', type: 'select', default: 'Apple product page', options: ['Apple product page', 'editorial magazine', 'tech review hero', 'minimalist Scandinavian'] },
      { key: 'post_processing', label: '后期', type: 'text', default: 'subtle vignette, gentle bloom on highlights' },
    ],
    coverImage: IMAGES.product.cover[2],
    exampleImages: [IMAGES.product.examples[0], IMAGES.product.examples[2], IMAGES.product.examples[3]],
    modelHint: 'gpt-image-2',
    tags: ['3D渲染', '产品设计', '工业设计', '概念图'],
    useCount: 387,
    likeCount: 163,
  },

  // ━━━━━━━━━━━━ 插画 ━━━━━━━━━━━━
  {
    title: '扁平矢量插画',
    description:
      '创建现代风格的扁平矢量插画，色彩鲜明、构图清晰。适合 APP 引导页、网站头图、演示文稿配图。',
    category: '插画',
    prompt: `A modern flat vector illustration depicting {{scene}}. Style: clean geometric shapes, {{color_scheme}} color scheme with {{accent}} accent color. Characters have {{character_style}} proportions. The scene includes {{elements}} as decorative elements. Background uses {{bg_pattern}} pattern. No outlines, soft shadows only. Suitable for {{use_case}}. SVG-quality crisp edges, consistent line weight.`,
    variables: [
      { key: 'scene', label: '场景', type: 'text', default: 'a diverse team collaborating in a modern office with floating UI elements' },
      { key: 'color_scheme', label: '配色', type: 'select', default: 'vibrant blue and coral', options: ['vibrant blue and coral', 'soft pastel rainbow', 'monochrome purple', 'nature green and brown', 'bold primary colors'] },
      { key: 'accent', label: '点缀色', type: 'text', default: 'golden yellow' },
      { key: 'character_style', label: '人物风格', type: 'select', default: 'slightly exaggerated, friendly', options: ['slightly exaggerated, friendly', 'minimalist stick-figure', 'realistic proportions', 'chibi/cute small body'] },
      { key: 'elements', label: '装饰元素', type: 'text', default: 'abstract shapes, small icons, dot patterns, and plant leaves' },
      { key: 'bg_pattern', label: '背景样式', type: 'select', default: 'subtle dot grid', options: ['subtle dot grid', 'soft gradient', 'geometric tessellation', 'plain flat color', 'organic blob shapes'] },
      { key: 'use_case', label: '用途', type: 'select', default: 'tech startup landing page', options: ['tech startup landing page', 'mobile app onboarding', 'presentation slide', 'social media post', 'blog article header'] },
    ],
    coverImage: IMAGES.illustration.cover[0],
    exampleImages: IMAGES.illustration.examples.slice(0, 3),
    modelHint: 'gpt-image-2',
    tags: ['扁平设计', '矢量', 'UI插画', '现代'],
    useCount: 578,
    likeCount: 312,
  },
  {
    title: '像素艺术场景',
    description:
      '创建精致的像素艺术风格场景，适合独立游戏资源、复古风格设计、怀旧主题项目。支持多种色彩限制模式。',
    category: '插画',
    prompt: `A detailed pixel art scene of {{scene}} in {{resolution}} pixel resolution. Color palette limited to {{palette}} colors in {{palette_style}} style. The scene features {{details}} with {{animation_hint}} as animated elements (implied motion). Perspective: {{perspective}}. Dithering technique: {{dithering}}. Inspired by {{inspiration}} game aesthetics. Clean pixel edges, no anti-aliasing.`,
    variables: [
      { key: 'scene', label: '场景', type: 'text', default: 'a cozy fantasy tavern interior at night' },
      { key: 'resolution', label: '分辨率', type: 'select', default: '320x240', options: ['160x120 (low)', '320x240 (classic)', '640x480 (high)', '128x128 (tile)'] },
      { key: 'palette', label: '色数', type: 'select', default: '32', options: ['8 (minimal)', '16 (retro)', '32 (rich)', '64 (detailed)'] },
      { key: 'palette_style', label: '调色板', type: 'select', default: 'warm fantasy', options: ['warm fantasy', 'cool cyberpunk', 'GameBoy green', 'NES classic', 'sunset gradient'] },
      { key: 'details', label: '细节', type: 'text', default: 'a crackling fireplace, wooden furniture, hanging lanterns, and shelves with potions' },
      { key: 'animation_hint', label: '动态元素', type: 'text', default: 'flickering flames and floating dust particles' },
      { key: 'perspective', label: '视角', type: 'select', default: 'side-scrolling', options: ['side-scrolling', 'isometric 3/4 view', 'top-down', 'first-person frame'] },
      { key: 'dithering', label: '抖动技法', type: 'select', default: 'ordered pattern', options: ['ordered pattern', 'Floyd-Steinberg diffusion', 'checkerboard', 'none (flat fill)'] },
      { key: 'inspiration', label: '灵感来源', type: 'text', default: 'Stardew Valley and Celeste' },
    ],
    coverImage: IMAGES.illustration.cover[1],
    exampleImages: IMAGES.illustration.examples.slice(1, 4),
    modelHint: 'gpt-image-2',
    tags: ['像素艺术', '游戏', '复古', '独立游戏'],
    useCount: 445,
    likeCount: 267,
  },
  {
    title: '儿童绘本插画',
    description:
      '创建温馨可爱的儿童绘本风格插画，色彩柔和、造型圆润。适合童书出版、教育产品、亲子品牌视觉。',
    category: '插画',
    prompt: `A charming children's book illustration of {{scene}}. Art style: {{style}} with {{texture}} texture. The main character is {{character}}, drawn with rounded, friendly proportions. Color palette: {{colors}} with soft gradients. The background features {{background}}. Whimsical {{decorative}} decorative elements scattered around. Emotional tone: {{emotion}}. High-resolution print-ready illustration.`,
    variables: [
      { key: 'scene', label: '场景', type: 'text', default: 'a little fox exploring an enchanted forest' },
      { key: 'style', label: '画风', type: 'select', default: 'hand-painted watercolor', options: ['hand-painted watercolor', 'colored pencil sketch', 'gouache flat color', 'digital soft brush', 'paper collage'] },
      { key: 'texture', label: '纹理', type: 'select', default: 'visible brush strokes with paper grain', options: ['visible brush strokes with paper grain', 'smooth digital finish', 'crayon and chalk overlay', 'linen canvas'] },
      { key: 'character', label: '主角', type: 'text', default: 'a curious baby fox wearing a tiny red scarf' },
      { key: 'colors', label: '色彩', type: 'select', default: 'warm pastels (peach, mint, lavender)', options: ['warm pastels (peach, mint, lavender)', 'primary colors (red, yellow, blue)', 'earth tones (brown, green, cream)', 'rainbow spectrum'] },
      { key: 'background', label: '背景', type: 'text', default: 'towering mushrooms, glowing fireflies, and a winding path' },
      { key: 'decorative', label: '装饰', type: 'text', default: 'tiny stars, floating leaves, and musical notes' },
      { key: 'emotion', label: '情感', type: 'select', default: 'wonder and curiosity', options: ['wonder and curiosity', 'cozy and safe', 'adventurous and brave', 'sleepy and peaceful'] },
    ],
    coverImage: IMAGES.illustration.cover[2],
    exampleImages: [IMAGES.illustration.examples[0], IMAGES.illustration.examples[2], IMAGES.illustration.examples[3]],
    modelHint: 'gpt-image-2',
    tags: ['绘本', '儿童', '可爱', '出版'],
    useCount: 298,
    likeCount: 176,
  },

  // ━━━━━━━━━━━━ 建筑 ━━━━━━━━━━━━
  {
    title: '现代建筑可视化',
    description:
      '生成专业级建筑渲染效果图，涵盖住宅、商业、公共建筑等类型。适合建筑方案展示、地产营销、设计竞赛。',
    category: '建筑',
    prompt: `An architectural visualization of a {{building_type}} designed in {{style}} style. The building features {{facade}} facade with {{material}} primary material. Surrounded by {{landscaping}} landscaping. Time of day: {{time}}, creating {{lighting}} lighting atmosphere. Perspective: {{perspective}} view. People and {{vehicles}} add human scale. Rendered in V-Ray quality, 8K resolution, photorealistic materials and vegetation.`,
    variables: [
      { key: 'building_type', label: '建筑类型', type: 'select', default: 'luxury waterfront villa', options: ['luxury waterfront villa', 'urban mixed-use tower', 'cultural museum', 'sustainable office campus', 'boutique hotel'] },
      { key: 'style', label: '建筑风格', type: 'select', default: 'contemporary minimalist', options: ['contemporary minimalist', 'parametric / organic', 'neo-brutalist', 'biophilic green', 'Japanese wabi-sabi'] },
      { key: 'facade', label: '立面', type: 'text', default: 'floor-to-ceiling glazing with thin aluminum mullions' },
      { key: 'material', label: '主材', type: 'select', default: 'white concrete and glass', options: ['white concrete and glass', 'Corten steel and timber', 'natural stone and bronze', 'exposed brick and steel', 'bamboo and rammed earth'] },
      { key: 'landscaping', label: '景观', type: 'text', default: 'infinity pool, mature olive trees, and native grasses' },
      { key: 'time', label: '时间', type: 'select', default: 'late afternoon golden hour', options: ['late afternoon golden hour', 'blue hour dusk with interior lights on', 'bright midday', 'dawn mist', 'night with dramatic uplighting'] },
      { key: 'lighting', label: '光氛', type: 'text', default: 'warm golden light casting long shadows' },
      { key: 'perspective', label: '视角', type: 'select', default: 'eye-level street', options: ['eye-level street', 'aerial bird-eye', 'worm-eye dramatic', 'interior looking out', 'axonometric diagram'] },
      { key: 'vehicles', label: '配景', type: 'text', default: 'parked luxury cars and cyclists' },
    ],
    coverImage: IMAGES.architecture.cover[0],
    exampleImages: IMAGES.architecture.examples.slice(0, 3),
    modelHint: 'gpt-image-2',
    tags: ['建筑', '可视化', '渲染', '设计'],
    useCount: 412,
    likeCount: 198,
  },
  {
    title: '室内设计效果图',
    description:
      '创建高品质室内设计渲染效果图，精确控制空间布局、材质搭配和光照氛围。适合家装方案、酒店设计、商业空间展示。',
    category: '建筑',
    prompt: `A photorealistic interior design rendering of a {{room_type}} in {{design_style}} style. The space features {{floor}} flooring, {{wall}} walls, and {{ceiling}} ceiling treatment. Key furniture includes {{furniture}}. Lighting design: {{lighting}} creating a {{mood}} atmosphere. Window view shows {{window_view}}. Decorative accents: {{decor}}. Architectural Digest quality photography, wide-angle 24mm lens.`,
    variables: [
      { key: 'room_type', label: '房间类型', type: 'select', default: 'open-plan living and dining room', options: ['open-plan living and dining room', 'master bedroom suite', 'designer kitchen', 'spa-like bathroom', 'home office library'] },
      { key: 'design_style', label: '设计风格', type: 'select', default: 'contemporary warm minimalism', options: ['contemporary warm minimalism', 'Japanese wabi-sabi', 'mid-century modern', 'industrial loft', 'Scandinavian hygge', 'art deco glamour'] },
      { key: 'floor', label: '地面', type: 'select', default: 'herringbone oak parquet', options: ['herringbone oak parquet', 'polished concrete', 'marble slab', 'tatami mat', 'terrazzo'] },
      { key: 'wall', label: '墙面', type: 'text', default: 'warm white lime wash with accent wall in natural stone' },
      { key: 'ceiling', label: '天花', type: 'select', default: 'exposed wooden beams', options: ['exposed wooden beams', 'smooth white plaster', 'coffered paneling', 'vaulted skylight', 'industrial exposed ductwork'] },
      { key: 'furniture', label: '家具', type: 'text', default: 'low-profile linen sofa, walnut coffee table, and sculptural armchair' },
      { key: 'lighting', label: '照明', type: 'text', default: 'large pendant lights, recessed cove lighting, and floor lamps' },
      { key: 'mood', label: '氛围', type: 'select', default: 'warm and inviting', options: ['warm and inviting', 'bright and airy', 'moody and dramatic', 'serene and zen'] },
      { key: 'window_view', label: '窗景', type: 'text', default: 'lush garden with mature trees' },
      { key: 'decor', label: '装饰', type: 'text', default: 'ceramic vases, coffee table books, and a large abstract painting' },
    ],
    coverImage: IMAGES.architecture.cover[1],
    exampleImages: IMAGES.architecture.examples.slice(1, 4),
    modelHint: 'gpt-image-2',
    tags: ['室内设计', '家装', '效果图', '空间设计'],
    useCount: 567,
    likeCount: 324,
  },

  // ━━━━━━━━━━━━ 科幻 ━━━━━━━━━━━━
  {
    title: '太空歌剧场景',
    description:
      '创建宏大的太空歌剧风格场景，宇宙飞船、星际战场、外星文明。适合科幻小说封面、游戏概念设定、影视概念图。',
    category: '科幻',
    prompt: `A grand space opera scene depicting {{scene}} in deep space. The focal point is {{focal_point}} with {{scale}} sense of scale. Surrounding celestial bodies include {{celestial}}. The color palette features {{colors}} with {{light_source}} as the primary light source. Spacecraft design style: {{ship_style}}. Atmospheric effects: {{effects}}. Concept art quality, matte painting technique, cinematic widescreen 21:9 aspect ratio.`,
    variables: [
      { key: 'scene', label: '场景', type: 'text', default: 'a massive fleet emerging from hyperspace near a ringed gas giant' },
      { key: 'focal_point', label: '焦点', type: 'text', default: 'a kilometer-long flagship dreadnought with glowing engine arrays' },
      { key: 'scale', label: '尺度感', type: 'select', default: 'overwhelming sense of cosmic scale', options: ['overwhelming sense of cosmic scale', 'intimate personal cockpit view', 'mid-range tactical overview', 'planetary scale from orbit'] },
      { key: 'celestial', label: '天体', type: 'text', default: 'a swirling nebula backdrop, scattered asteroid field, and twin moons' },
      { key: 'colors', label: '色彩', type: 'select', default: 'deep navy, electric blue, and amber warning lights', options: ['deep navy, electric blue, and amber warning lights', 'crimson and dark bronze war tones', 'ethereal white and gold divine fleet', 'green and purple alien technology'] },
      { key: 'light_source', label: '光源', type: 'select', default: 'a nearby blue supergiant star', options: ['a nearby blue supergiant star', 'the glow of a distant galaxy', 'weapon discharge and explosions', 'bioluminescent alien structures'] },
      { key: 'ship_style', label: '飞船风格', type: 'select', default: 'angular military industrial', options: ['angular military industrial', 'organic bio-mechanical', 'sleek and elegant', 'massive and utilitarian', 'crystalline alien'] },
      { key: 'effects', label: '特效', type: 'text', default: 'engine contrails, shield shimmer, and lens flare from distant star' },
    ],
    coverImage: IMAGES.scifi.cover[0],
    exampleImages: IMAGES.scifi.examples.slice(0, 3),
    modelHint: 'gpt-image-2',
    tags: ['科幻', '太空', '概念艺术', '游戏'],
    useCount: 689,
    likeCount: 401,
  },
  {
    title: '废土末世场景',
    description:
      '描绘后启示录风格的废墟世界，荒芜城市、废弃设施与顽强求生的场景。适合游戏环境设计、小说封面、影视概念。',
    category: '科幻',
    prompt: `A post-apocalyptic scene showing {{location}} overtaken by {{nature}}. The sky is {{sky}} with {{weather}} conditions. In the foreground, {{foreground_detail}} tells the story of the world that was. Signs of {{civilization}} hint at past civilization. A {{survivor}} figure provides human scale. The overall tone is {{tone}}. Lighting: {{lighting}}. Ultra-detailed environment concept art, 4K, inspired by The Last of Us and Horizon Zero Dawn.`,
    variables: [
      { key: 'location', label: '地点', type: 'text', default: 'a crumbling downtown skyline with collapsed skyscrapers' },
      { key: 'nature', label: '自然侵蚀', type: 'select', default: 'dense vegetation and vines reclaiming structures', options: ['dense vegetation and vines reclaiming structures', 'desert sand dunes burying buildings', 'ice and frost covering everything', 'toxic fungal growth', 'flooding and waterlogged streets'] },
      { key: 'sky', label: '天空', type: 'select', default: 'hazy orange with pollution clouds', options: ['hazy orange with pollution clouds', 'grey overcast and oppressive', 'unnaturally green tinted', 'clear but empty (no planes or contrails)', 'perpetual twilight'] },
      { key: 'weather', label: '天气', type: 'select', default: 'dusty winds', options: ['dusty winds', 'acid rain', 'radioactive snow', 'eerie calm', 'electrical storms'] },
      { key: 'foreground_detail', label: '前景细节', type: 'text', default: 'a rusted car with an open door and scattered personal belongings' },
      { key: 'civilization', label: '文明遗迹', type: 'text', default: 'faded billboards, broken traffic lights, and a tilted Ferris wheel' },
      { key: 'survivor', label: '人物', type: 'text', default: 'a lone scavenger with a makeshift backpack and gas mask' },
      { key: 'tone', label: '基调', type: 'select', default: 'melancholic beauty in decay', options: ['melancholic beauty in decay', 'tense and dangerous', 'hopeful rebirth', 'haunting and desolate'] },
      { key: 'lighting', label: '光线', type: 'select', default: 'god rays breaking through clouds', options: ['god rays breaking through clouds', 'dim overcast flat light', 'harsh noon sun', 'campfire warm glow', 'bioluminescent night'] },
    ],
    coverImage: IMAGES.scifi.cover[2],
    exampleImages: IMAGES.scifi.examples.slice(1, 4),
    modelHint: 'gpt-image-2',
    tags: ['末世', '废土', '概念艺术', '环境设计'],
    useCount: 534,
    likeCount: 312,
  },
  {
    title: '未来都市概念',
    description:
      '构想未来城市的面貌，融合先进科技与城市规划愿景。飞行汽车、悬浮建筑、全息广告构成未来都市图景。',
    category: '科幻',
    prompt: `A futuristic cityscape of {{era}} showing {{city_type}} urban environment. Transportation includes {{transport}}. Architecture features {{arch_feature}} with {{material}} materials. The streets have {{street_life}} activity. Holographic {{holograms}} displays illuminate the scene. Sky features {{sky}} with {{aerial}} in the air. Technology level: {{tech_level}}. Time: {{time_of_day}}. Concept art, digital painting, ultra-wide cinematic framing.`,
    variables: [
      { key: 'era', label: '时代', type: 'select', default: 'year 2150', options: ['year 2150', 'year 2300', 'year 3000', 'far future post-singularity'] },
      { key: 'city_type', label: '城市类型', type: 'select', default: 'utopian green solarpunk', options: ['utopian green solarpunk', 'cyberpunk neon dystopia', 'underwater dome city', 'orbital space station ring', 'floating cloud city'] },
      { key: 'transport', label: '交通', type: 'text', default: 'flying vehicles at multiple altitude lanes, magnetic rail pods' },
      { key: 'arch_feature', label: '建筑特征', type: 'text', default: 'spiraling organic towers connected by sky bridges' },
      { key: 'material', label: '材料', type: 'select', default: 'self-healing smart glass and living walls', options: ['self-healing smart glass and living walls', 'dark metal and neon strips', 'crystal and energy fields', 'bio-grown coral structures'] },
      { key: 'street_life', label: '街景', type: 'text', default: 'diverse crowds, robotic vendors, and holographic street performers' },
      { key: 'holograms', label: '全息', type: 'text', default: 'floating advertisements, wayfinding arrows, and public art installations' },
      { key: 'sky', label: '天空', type: 'select', default: 'clear blue with a visible orbital ring', options: ['clear blue with a visible orbital ring', 'perpetual cloud cover with neon glow', 'dome-enclosed artificial sky', 'open to stars and nebulae'] },
      { key: 'aerial', label: '空中元素', type: 'text', default: 'delivery drones and personal air vehicles' },
      { key: 'tech_level', label: '科技水平', type: 'select', default: 'advanced but recognizable', options: ['advanced but recognizable', 'near-magic Clarke-level', 'transitional (old meets new)', 'post-scarcity abundance'] },
      { key: 'time_of_day', label: '时间', type: 'select', default: 'neon-lit night', options: ['neon-lit night', 'golden sunrise', 'rainy evening', 'busy midday'] },
    ],
    coverImage: IMAGES.scifi.cover[1],
    exampleImages: [IMAGES.scifi.examples[0], IMAGES.scifi.examples[2], IMAGES.scifi.examples[3]],
    modelHint: 'gpt-image-2',
    tags: ['未来城市', '概念设计', '科幻', '都市'],
    useCount: 478,
    likeCount: 289,
  },

  // ━━━━━━━━━━━━ 场景 ━━━━━━━━━━━━
  {
    title: '影视分镜概念图',
    description:
      '为影视项目创建专业级分镜概念图，精准传达导演想象中的画面。适合电影预演、广告拍摄前期、短视频策划。',
    category: '场景',
    prompt: `A cinematic storyboard concept frame of {{scene_description}}. Camera: {{shot_type}} shot with {{camera_movement}} movement. Lens: {{lens}}mm creating {{lens_effect}} effect. Lighting motivation: {{lighting_source}}. Color grade: {{color_grade}}. The frame conveys {{emotion}} emotion. Depth layers: foreground has {{foreground}}, midground has {{midground}}, background has {{background}}. Widescreen 2.39:1 anamorphic aspect ratio, film grain, cinematic quality.`,
    variables: [
      { key: 'scene_description', label: '场景描述', type: 'text', default: 'a detective walking alone through a rain-soaked neon alley at night' },
      { key: 'shot_type', label: '景别', type: 'select', default: 'wide establishing', options: ['extreme wide establishing', 'wide establishing', 'medium', 'close-up', 'extreme close-up', 'over-the-shoulder'] },
      { key: 'camera_movement', label: '运镜', type: 'select', default: 'slow dolly forward', options: ['slow dolly forward', 'steady handheld', 'crane descending', 'tracking lateral', 'locked tripod static', 'drone ascending'] },
      { key: 'lens', label: '焦距', type: 'select', default: '35', options: ['14', '24', '35', '50', '85', '135'] },
      { key: 'lens_effect', label: '镜头效果', type: 'select', default: 'slight anamorphic lens flare', options: ['slight anamorphic lens flare', 'deep focus everything sharp', 'heavy bokeh background blur', 'tilt-shift miniature', 'fish-eye distortion'] },
      { key: 'lighting_source', label: '光源', type: 'text', default: 'neon signs and wet surface reflections' },
      { key: 'color_grade', label: '调色', type: 'select', default: 'teal and orange (blockbuster)', options: ['teal and orange (blockbuster)', 'desaturated cold (thriller)', 'warm golden (nostalgia)', 'high contrast noir', 'natural balanced'] },
      { key: 'emotion', label: '情绪', type: 'select', default: 'tension and anticipation', options: ['tension and anticipation', 'awe and wonder', 'melancholy and loss', 'joy and triumph', 'fear and dread'] },
      { key: 'foreground', label: '前景', type: 'text', default: 'rain droplets on a window pane, slightly out of focus' },
      { key: 'midground', label: '中景', type: 'text', default: 'the silhouette of the protagonist' },
      { key: 'background', label: '背景', type: 'text', default: 'towering buildings with flickering neon signs' },
    ],
    coverImage: IMAGES.scene.cover[0],
    exampleImages: IMAGES.scene.examples.slice(0, 3),
    modelHint: 'gpt-image-2',
    tags: ['分镜', '电影', '概念图', '影视'],
    useCount: 367,
    likeCount: 198,
  },
  {
    title: '游戏场景环境设定',
    description:
      '为游戏项目创建沉浸感十足的环境设定图。涵盖奇幻、现代、历史等多种世界观风格。适合游戏开发美术前期。',
    category: '场景',
    prompt: `A game environment concept art of {{environment}} in {{game_genre}} genre. The scene uses {{art_style}} art direction with {{color_mood}} color mood. Key landmarks include {{landmarks}}. Environmental storytelling through {{story_elements}}. Weather: {{weather}}. Vegetation: {{vegetation}}. The path or navigation hints guide the player toward {{destination}}. Game engine quality, concept art painting, 16:9 widescreen.`,
    variables: [
      { key: 'environment', label: '环境', type: 'text', default: 'an ancient elven city built into massive tree canopies' },
      { key: 'game_genre', label: '游戏类型', type: 'select', default: 'open-world fantasy RPG', options: ['open-world fantasy RPG', 'survival horror', 'sci-fi shooter', 'cozy life sim', 'stealth action', 'historical adventure'] },
      { key: 'art_style', label: '美术风格', type: 'select', default: 'stylized painterly', options: ['stylized painterly', 'photorealistic', 'cel-shaded cartoon', 'low-poly minimalist', 'hand-painted texture'] },
      { key: 'color_mood', label: '色彩情绪', type: 'select', default: 'enchanted green and gold', options: ['enchanted green and gold', 'ominous red and black', 'sterile white and blue', 'warm autumn palette', 'monochrome with one accent color'] },
      { key: 'landmarks', label: '地标', type: 'text', default: 'a crystal waterfall, spiral staircase around a giant tree, and a glowing shrine' },
      { key: 'story_elements', label: '叙事元素', type: 'text', default: 'ancient carvings on tree bark, abandoned elven artifacts, and overgrown pathways' },
      { key: 'weather', label: '天气', type: 'select', default: 'dappled sunlight through canopy', options: ['dappled sunlight through canopy', 'heavy fog and mist', 'gentle rain', 'magical particle snow', 'aurora-lit night'] },
      { key: 'vegetation', label: '植被', type: 'text', default: 'giant ferns, bioluminescent mushrooms, and hanging moss' },
      { key: 'destination', label: '目的地', type: 'text', default: 'a distant glowing portal between two ancient trees' },
    ],
    coverImage: IMAGES.scene.cover[1],
    exampleImages: IMAGES.scene.examples.slice(1, 4),
    modelHint: 'gpt-image-2',
    tags: ['游戏', '环境设定', '概念艺术', '世界观'],
    useCount: 623,
    likeCount: 378,
  },
  {
    title: '节日庆典氛围图',
    description:
      '创建各种节日和庆典的氛围场景图，适合节日营销海报、活动背景、社交媒体节日主题内容。',
    category: '场景',
    prompt: `A festive scene celebrating {{festival}} with {{cultural_style}} cultural aesthetics. The setting is {{venue}} decorated with {{decorations}}. People are {{activities}} together. Food and drinks include {{food}}. The lighting creates {{lighting}} atmosphere with {{special_effects}} special effects. Colors dominated by {{colors}}. Emotional tone: {{emotion}}. Illustration style: {{style}}. High-resolution, suitable for print and digital media.`,
    variables: [
      { key: 'festival', label: '节日', type: 'select', default: '中秋节 (Mid-Autumn Festival)', options: ['中秋节 (Mid-Autumn Festival)', '春节 (Chinese New Year)', 'Christmas', 'Halloween', 'Diwali', '万圣节派对', '夏日音乐节'] },
      { key: 'cultural_style', label: '文化风格', type: 'text', default: 'traditional Chinese with modern fusion elements' },
      { key: 'venue', label: '场地', type: 'text', default: 'a moonlit garden with a pavilion by a lotus pond' },
      { key: 'decorations', label: '装饰', type: 'text', default: 'glowing lanterns, silk ribbons, and osmanthus flower garlands' },
      { key: 'activities', label: '活动', type: 'text', default: 'sharing mooncakes, admiring the full moon, and children carrying lanterns' },
      { key: 'food', label: '食物', type: 'text', default: 'traditional mooncakes, pomelo, tea, and osmanthus wine' },
      { key: 'lighting', label: '光照', type: 'select', default: 'warm lantern glow and moonlight', options: ['warm lantern glow and moonlight', 'bright daylight celebration', 'colorful string lights', 'candlelight intimate', 'fireworks-lit sky'] },
      { key: 'special_effects', label: '特效', type: 'text', default: 'floating lanterns rising into the starry sky' },
      { key: 'colors', label: '主色调', type: 'text', default: 'deep red, warm gold, and moonlight silver' },
      { key: 'emotion', label: '情感', type: 'select', default: 'warmth and togetherness', options: ['warmth and togetherness', 'excitement and energy', 'peaceful and grateful', 'playful and fun'] },
      { key: 'style', label: '画风', type: 'select', default: 'warm digital painting with soft edges', options: ['warm digital painting with soft edges', 'photorealistic rendering', 'flat vector modern', 'traditional ink and color'] },
    ],
    coverImage: IMAGES.scene.cover[2],
    exampleImages: [IMAGES.scene.examples[0], IMAGES.scene.examples[2], IMAGES.scene.examples[3]],
    modelHint: 'gpt-image-2',
    tags: ['节日', '庆典', '营销', '文化'],
    useCount: 312,
    likeCount: 167,
  },
];

// ── 执行 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🌱 开始种入模板数据...`);
  console.log(`   数据库: ${process.env.CHAT_DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`);
  console.log(`   作者 ID: ${AUTHOR_ID}`);
  console.log(`   模板总数: ${templates.length}`);
  console.log('');

  const now = new Date();

  let created = 0;
  let skipped = 0;

  for (const tpl of templates) {
    const existing = await prisma.prompt_templates.findFirst({
      where: { title: tpl.title, authorId: AUTHOR_ID },
    });

    if (existing) {
      console.log(`   ⏭  跳过 (已存在): ${tpl.title}`);
      skipped++;
      continue;
    }

    await prisma.prompt_templates.create({
      data: {
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        prompt: tpl.prompt,
        variables: tpl.variables as any,
        coverImage: tpl.coverImage,
        exampleImages: tpl.exampleImages,
        modelHint: tpl.modelHint,
        tags: tpl.tags,
        authorId: AUTHOR_ID,
        status: 'APPROVED',
        useCount: tpl.useCount,
        likeCount: tpl.likeCount,
        publishedAt: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`   ✅ ${tpl.category} / ${tpl.title}`);
    created++;
  }

  console.log('');
  console.log(`🎉 完成! 新建 ${created} 条, 跳过 ${skipped} 条`);

  const stats = await prisma.prompt_templates.groupBy({
    by: ['category'],
    _count: true,
    where: { status: 'APPROVED' },
  });

  console.log('');
  console.log('📊 各分类统计:');
  for (const s of stats) {
    console.log(`   ${s.category}: ${s._count} 条`);
  }
}

main()
  .catch((err) => {
    console.error('❌ 种子脚本失败:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
