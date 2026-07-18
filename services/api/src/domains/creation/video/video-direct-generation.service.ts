import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PointsService } from '../../billing/points/points.service';
import { MembershipService } from '../../billing/membership/membership.service';
import { RiskService } from '../risk/risk.service';
import { VideoCallbackUrlBuilder } from './video-callback-url.builder';
import { VideoGenerationHoldReconciliationService } from './video-generation-hold-reconciliation.service';
import { VideoGenerationModelResolverService } from './video-generation-model-resolver.service';
import { VideoGenerationRepository } from './video-generation.repository';
import {
  buildSeedanceCostEstimateInput,
  buildVideoHoldInput,
  buildDirectGenerationParamsSnapshot,
  normalizeVideoGenerationClipParamsForModel,
  resolveVideoGenerationRequestLimits,
  type VideoGenerationClipParams as ClipParams,
} from './video-generation-flow.helpers';
import {
  assembleVideoRequest,
  resolveVideoPreset,
  submitVideoTask,
  videoSubmitUrl,
  VideoUpstreamError,
  type VideoMaterialInput,
} from '@autix/ai-adapters/video';
import { readProtocolKey } from '@autix/domain/model';
import { toUnifiedVideoParams, type VideoMaterialRole, type VideoModelHint } from '@autix/domain/video';

export interface DirectVideoMaterialInput {
  role: VideoMaterialRole;
  url: string;
  sourceType?: string;
  name?: string | null;
}

export interface DirectVideoGenerateInput {
  userId: string;
  prompt: string;
  materials: DirectVideoMaterialInput[];
  clientParams: Record<string, unknown>;
}

/**
 * 直连生成（`/ai/video`，无父 project/clip 行）的提交路径。
 *
 * 结构对齐 `VideoGenerationFlowService.generateClip`（见该文件同名方法），差异只在：
 * 不读/不写 clip、project 父行；落库用 `createDirectPendingGeneration`
 * （clipId/projectId 恒 null）；提交失败标终态用 `markDirectGenerationFailed`
 * （只 update generation 行，不 update 不存在的父 clip）。
 */
@Injectable()
export class VideoDirectGenerationService {
  private readonly logger = new Logger(VideoDirectGenerationService.name);

  constructor(
    private readonly repository: VideoGenerationRepository,
    private readonly pointsService: PointsService,
    private readonly modelResolver: VideoGenerationModelResolverService,
    private readonly callbackUrlBuilder: VideoCallbackUrlBuilder,
    private readonly membershipService: MembershipService,
    private readonly riskService: RiskService,
    private readonly holdReconciliation: VideoGenerationHoldReconciliationService,
  ) {}

  async generate(input: DirectVideoGenerateInput) {
    const prompt = input.prompt?.trim();
    if (!prompt) throw new BadRequestException('请输入提示词');
    const generationId = randomUUID();

    // 服务端强制 standard，忽略客户端 params.model / params.generationMode（FIX-3，
    // 同 generateClip：防「选便宜模型过鉴权、用 params.model 偷换为贵模型」）。
    const rawParams = { ...input.clientParams, generationMode: 'standard' } as ClipParams;
    delete (rawParams as Record<string, unknown>).model;

    // P1-a：带 userId 的用户作用域解析（触发 assertUserCanUseModel）——
    // 禁用不带 userId 的 resolveApiContextForClipParams，那条路径不鉴权会员可用模型。
    const { modelConfigId, modelConfig, apiKey, baseUrl } =
      await this.modelResolver.resolveForGeneration(
        { id: generationId, params: rawParams as any },
        input.userId,
      );

    const hint: VideoModelHint = {
      provider: modelConfig.provider,
      model: modelConfig.model,
      metadata:
        modelConfig.metadata && typeof modelConfig.metadata === 'object' && !Array.isArray(modelConfig.metadata)
          ? (modelConfig.metadata as VideoModelHint['metadata'])
          : null,
    };
    const params = normalizeVideoGenerationClipParamsForModel(rawParams, hint);

    // P0-1/P3-2：会员闸门 + 风控，必须在 createHold / 调用供应商之前完成
    // （同 generateClip，避免占用积分和成本）。
    const entitlement = await this.membershipService.resolveVideoEntitlements(input.userId);
    const limits = resolveVideoGenerationRequestLimits(params, hint);
    this.membershipService.assertVideoEntitlement(entitlement, {
      resolution: limits.resolution,
      durationSeconds: limits.durationSeconds,
    });
    await this.riskService.assertVideoRequest(input.userId, entitlement, {
      resolution: limits.resolution,
      durationSeconds: limits.durationSeconds,
    });

    const preset = resolveVideoPreset(readProtocolKey(modelConfig.metadata));
    const callbackUrl = this.callbackUrlBuilder.build(preset.key);
    const callRequest = {
      preset,
      baseUrl: baseUrl?.trim()?.replace(/\/+$/, '') || 'https://ark.cn-beijing.volces.com',
      apiKey,
      // FIX-3：始终使用服务端解析/鉴权过的模型，忽略客户端传入的 params.model。
      model: modelConfig.model,
      prompt,
      materials: input.materials as VideoMaterialInput[],
      params: toUnifiedVideoParams(params),
      callbackUrl,
    };
    const requestBody = assembleVideoRequest(callRequest);

    // 诊断日志：打出实际发给上游的 endpoint + 完整请求体，方便核对参数是否符合上游要求。
    this.logger.log(
      `direct generation upstream submit: ${JSON.stringify({
        generationId,
        protocolKey: preset.key,
        model: callRequest.model,
        endpoint: videoSubmitUrl(preset, callRequest.baseUrl),
        requestBody,
      })}`,
    );

    // 判空协议无关（同 generateClip 的注释）：prompt 在函数入口已强制非空
    // （见上方 `if (!prompt) throw`），故这里实际总是为真——保留只作为协议引擎
    // 未来放宽 prompt 必填时的安全网，不读 requestBody.content
    // （flat-media 协议没有 content 数组，读它会对空素材恒判空）。
    if (prompt.trim().length === 0 && input.materials.length === 0) {
      throw new BadRequestException('缺少素材或 prompt');
    }

    const estimateInput = buildSeedanceCostEstimateInput({
      params,
      modelConfigId,
      membershipLevel: entitlement.level,
    });
    const estimate = await this.pointsService.estimateCost(estimateInput);
    const { hold } = await this.pointsService.createHold(
      input.userId,
      buildVideoHoldInput({
        billingTaskType: estimateInput.taskType,
        generationId,
        estimatedCost: estimate.estimatedCost,
        pricingSnapshot: estimate.pricingSnapshot,
        projectId: null,
        clipId: null,
        modelConfigId,
        taskRequest: requestBody,
      }),
    );
    const holdId = hold.id;

    try {
      await this.repository.createDirectPendingGeneration({
        generationId,
        userId: input.userId,
        model: modelConfig.model,
        resolvedPrompt: prompt,
        params: buildDirectGenerationParamsSnapshot({
          options: {
            resolution: params.resolution,
            ratio: params.ratio,
            duration: params.duration,
            generateAudio: params.generateAudio,
          },
          materials: input.materials,
          providerRequest: requestBody,
        }),
        protocolKey: preset.key,
        modelConfigId,
      });
    } catch (err) {
      this.logger.error(
        `direct generation persist failed before submit, generation=${generationId} hold=${holdId}: ${String(err)}`,
      );
      await this.holdReconciliation.safeRefund(generationId, 'direct generation persist failed');
      throw err;
    }

    // 提交/落库边界（6.1.1，最高风险分支——三种结局对应三种处理）：
    //   1. 明确拒绝（上游确定未受理）    → 标失败 + 退款
    //   2. 已受理但本地落库失败         → 保 hold、不退款、不标失败（上游在跑，交孤儿回收）
    //   3. 不确定（网络/超时，可能已受理）→ 保 hold、不退款（同 2，交孤儿回收）
    // markGenerationCreateTaskFailedAndRefund **不能用**——它 update 父 clip，直连无 clip；
    // 用 markDirectGenerationFailed（只 update generation 行）。
    let providerTaskId: string;
    try {
      ({ providerTaskId } = await submitVideoTask(callRequest));
    } catch (err) {
      // 「明确拒绝」= 收到了上游响应、但任务根本没被创建 → 立即标失败 + 退款（否则会一直挂 pending）。
      //   - 4xx：上游明确拒绝。
      //   - VideoUpstreamError 且**无 httpStatus**：submit.ts 的「无 task id」——上游返回了 2xx 但
      //     没给任务 id（多为 200 错误体）。既然拿不到 id，就永远轮询不到、不可能恢复，属确定性失败，
      //     不能当「可能已受理」挂着。
      //   仍走 else（保 hold、交孤儿回收）的只有真·不确定：5xx（可能已受理）、网络/超时
      //   （不是 VideoUpstreamError，request 可能已到达上游）。
      const definitiveReject =
        err instanceof VideoUpstreamError &&
        ((err.httpStatus != null && err.httpStatus >= 400 && err.httpStatus < 500) ||
          err.httpStatus == null);
      if (definitiveReject) {
        await this.repository.markDirectGenerationFailed(
          generationId,
          err instanceof Error ? err.message : String(err),
        );
        await this.holdReconciliation.safeRefund(generationId, 'upstream rejected');
      } else {
        this.logger.warn(
          `direct submit uncertain, keep hold generation=${generationId}: ${String(err)}`,
        );
      }
      throw err;
    }

    try {
      await this.repository.markGenerationQueued(generationId, providerTaskId);
    } catch (err) {
      // 上游已受理、仅本地落库失败：不退款、不标失败，交孤儿回收
      // （PointsHoldReclaimCron 60min）+ 告警。
      this.logger.error(
        `direct queued-persist failed but upstream ACCEPTED, generation=${generationId}, taskId=${providerTaskId}: ${String(err)}`,
      );
      throw err;
    }

    return { generationId, taskId: providerTaskId };
  }
}
