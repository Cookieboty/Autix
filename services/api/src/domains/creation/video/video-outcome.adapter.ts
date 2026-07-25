import type { VideoTaskOutcome } from '@autix/ai-adapters/video';
import { VideoGenStatus } from '../../platform/prisma/generated';
import type { NormalizedSeedanceTaskOutcome } from './video-generation-flow.helpers';

/**
 * 引擎终态 → 既有的内部词汇。
 *
 * 存在的理由：引擎**不返回** refundReason —— 面向用户的中文文案是 api-service 的 i18n
 * 职责，不该硬编码进协议适配层（同 VideoUpstreamError 的 message 只放英文诊断串）。
 * 引擎也把 expired 提成了顶层 kind，而旧词汇用 kind:'failed' + generationStatus 区分。
 *
 * 这层翻译让 applyTaskStatus 的整条下游（buildFailedGenerationInput / refundGenerationHoldWithinTx）
 * **一行都不用改** —— 切换的爆炸半径就此收敛在协议层。
 *
 * 取值逐字抄自已删除的 normalizeSeedanceTaskOutcome（计划 4 Task 4；`NormalizedSeedanceTaskOutcome`
 * 类型本身留存于 video-generation-flow.helpers.ts，仍是本文件与其它下游共用的词汇）。
 */
export function toLegacyVideoOutcome(outcome: VideoTaskOutcome): NormalizedSeedanceTaskOutcome {
  switch (outcome.kind) {
    case 'missing_status':
    case 'active':
      return outcome;
    // VideoTaskOutcome.succeeded 的 sourceUrl 是可选属性（'sourceUrl?: string'），而
    // NormalizedSeedanceTaskOutcome 要求该 key 必现（'sourceUrl: string | undefined'）——
    // 两者结构上不完全等价，'return outcome' 在这一分支下无法通过 typecheck，
    // 故显式重建对象（不改变取值本身，纯粹是让可选 key 变为必现 key）。
    case 'succeeded':
      return {
        kind: 'succeeded',
        externalStatus: outcome.externalStatus,
        sourceUrl: outcome.sourceUrl,
        lastFrameUrl: outcome.lastFrameUrl,
        durationSec: outcome.durationSec,
      };
    case 'failed':
    case 'expired': {
      const isExpired = outcome.kind === 'expired';
      return {
        kind: 'failed',
        externalStatus: outcome.externalStatus,
        generationStatus: isExpired ? VideoGenStatus.expired : VideoGenStatus.failed,
        error: outcome.error,
        refundReason: isExpired ? 'Video generation timed out' : `Video generation failed: ${outcome.error}`,
      };
    }
  }
}
