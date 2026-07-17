import type { VideoProtocolPreset } from '../types';

/**
 * 火山方舟（Ark）v3 —— 现网唯一的视频协议。
 *
 * 全部字段翻译自 services/api/src/domains/creation/video/：
 *   - endpoint / auth      ← seedance-api.service.ts:8-9, 173, 213-218
 *   - content 形态 / roles ← seedance-api.service.ts:60-66（ROLE_MAP）, 127-165（buildContent）
 *   - 省略语义             ← seedance-api.service.ts:288-303（buildTaskRequest）
 *   - 状态与取值 path      ← seedance-task-payload.ts:9-47, video-generation-flow.helpers.ts:613-643
 *   - 回调                 ← video-callback.handler.ts:33-44, video-callback-url.builder.ts:13-15
 */
export const arkVideoV3: VideoProtocolPreset = {
  key: 'ark-video@v3',
  transport: 'async-poll',
  // 只约束「拿到响应头」——safeFetch 在返回 Response 时解除超时，不影响调用方读 body。
  timeoutMs: 60_000,
  auth: { in: 'header', name: 'Authorization', template: 'Bearer {apiKey}' },

  submit: {
    endpoint: { method: 'POST', path: '/api/v3/contents/generations/tasks' },
    model: { path: 'model' },
    content: {
      strategy: 'typed-content-items',
      path: 'content',
      textItem: { type: 'text', field: 'text' },
      roleField: 'role',
      // 角色决定 item 形态：三个图片角色走 image_url，video/audio 各走自己的字段。
      // 五个角色必须全覆盖 —— VideoMaterialRole 枚举恰好是这五个（schema.prisma:1750-1756）。
      roleItems: {
        first_frame: { type: 'image_url', urlField: 'image_url', role: 'first_frame' },
        last_frame: { type: 'image_url', urlField: 'image_url', role: 'last_frame' },
        reference_image: { type: 'image_url', urlField: 'image_url', role: 'reference_image' },
        reference_video: { type: 'video_url', urlField: 'video_url', role: 'reference_video' },
        reference_audio: { type: 'audio_url', urlField: 'audio_url', role: 'reference_audio' },
      },
    },
    paramBindings: {
      // key = path = 火山原生字段名（UNIFIED_VIDEO_PARAM_KEYS 已原生化，paramsSchema 同名）。
      // 省略语义逐条对齐 buildTaskRequest:288-303，注释里标出对应的那一行。
      ratio: { path: 'ratio', omitWhen: 'falsy' }, // if (opts.ratio)
      duration: { path: 'duration', omitWhen: 'undefined' }, // if (opts.duration !== undefined) → 0 会发
      resolution: { path: 'resolution', omitWhen: 'falsy' }, // if (opts.resolution)
      generate_audio: { path: 'generate_audio', omitWhen: 'undefined' }, // !== undefined → false 会发
      watermark: { path: 'watermark', omitWhen: 'falsy' }, // if (opts.watermark)
      return_last_frame: { path: 'return_last_frame', omitWhen: 'falsy' }, // if (opts.returnLastFrame)
      seed: { path: 'seed', omitWhen: 'undefined', omitValues: [-1] }, // !== undefined && !== -1
    },
    // 出处是**厂商文档**而非代码：amux 的提交响应同时返回 id 与 task_id（值相同）。
    // 代码侧的 SeedanceTaskResponse（seedance-api.service.ts:33-35）只声明了 id ——
    // 因为现有实现只读它。候选链是廉价的保险，与文档一致，且不改变现网行为。
    taskIdPath: ['id', 'task_id'],
  },

  query: {
    endpoint: { method: 'GET', path: '/api/v3/contents/generations/tasks/{taskId}' },
  },

  result: {
    statusPath: 'status',
    // 与 normalizeSeedanceTaskOutcome（video-generation-flow.helpers.ts:604-634）的
    // **有意偏离**，信息量等价但结构更干净：
    //   旧实现对 failed 与 expired 都返回 kind:'failed'，靠次级字段区分 ——
    //     generationStatus: expired ? VideoGenStatus.expired : VideoGenStatus.failed
    //     refundReason:     expired ? '视频生成超时' : `视频生成失败: ${error}`
    //   本引擎把 expired 提成顶层 kind，**不返回 refundReason** —— 引擎不硬编码
    //   面向用户的中文文案（那是 api-service 的 i18n 职责，见 types.ts 的 VideoUpstreamError 注释）。
    //   kind 已足以让消费方推出 VideoGenStatus 与退款理由。
    // 切 flow 时（计划 4）必须建立 kind → (VideoGenStatus, refundReason) 的映射。
    statusMap: {
      queued: 'active',
      running: 'active',
      succeeded: 'succeeded',
      failed: 'failed',
      expired: 'expired',
    },
    // 两级回退，翻译自 getStringField(payload, 'video_url', 'video_url')：
    // 先顶层，未命中再 content.*。
    videoUrlPath: ['video_url', 'content.video_url'],
    lastFrameUrlPath: ['last_frame_url', 'content.last_frame_url'],
    durationPath: 'duration',
    errorMessagePath: 'error.message',
  },

  webhook: {
    callbackUrlBinding: { path: 'callback_url', omitWhen: 'falsy' }, // if (opts.callbackUrl)
    taskIdPath: 'id', // handler.ts:44 —— body.id
    verification: {
      kind: 'query-token',
      param: 'token',
      // 与现网一致，且 fail-closed：未配置该环境变量时拒绝回调。
      secretRef: 'VIDEO_CALLBACK_SECRET',
    },
  },

  errorMapping: { '400': 'params', '401': 'auth', '429': 'rate-limit', '*': 'upstream' },
};
