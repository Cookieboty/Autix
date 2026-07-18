import { UnauthorizedException } from '@nestjs/common';
import { parseVideoCallback, resolveVideoPreset, verifyVideoCallback } from '@autix/ai-adapters/video';

type LoggerLike = {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

type ConfigLike = {
  get<T = unknown>(key: string): T | undefined;
};

type GenerationFlowLike = {
  handleCallback(
    protocolKey: string,
    taskId: string,
    body: Record<string, unknown>,
  ): Promise<void>;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 回调入口的共用处理逻辑，供新路由（`:protocolKey`）与旧路由（固定 arkVideoV3）复用。
 *
 * 验签与解析都经协议引擎（Task 1）：`verifyVideoCallback` 保留了现网的 fail-closed
 * 契约 —— 密钥未配置（`secretRef` 指向的环境变量缺失）时**拒绝**，而不是放行。
 */
export async function handleVideoCallbackRequest(args: {
  protocolKey: string;
  token?: string;
  body: Record<string, unknown>;
  config: ConfigLike;
  generationFlow: GenerationFlowLike;
  logger: LoggerLike;
}) {
  const preset = resolveVideoPreset(args.protocolKey);
  const secretRef = preset.webhook?.verification.secretRef;
  const secret = secretRef ? args.config.get<string>(secretRef) : undefined;

  try {
    verifyVideoCallback({ preset, token: args.token, secret });
  } catch (err) {
    args.logger.warn(`Rejected video callback: ${errorMessage(err)}`);
    throw new UnauthorizedException();
  }

  const { providerTaskId } = parseVideoCallback({ preset, body: args.body });
  if (!providerTaskId) {
    args.logger.warn('Callback received without task id');
    return { received: true };
  }

  args.logger.log(
    `Video callback received: protocolKey=${args.protocolKey} taskId=${providerTaskId} status=${args.body.status}`,
  );

  try {
    await args.generationFlow.handleCallback(args.protocolKey, providerTaskId, args.body);
  } catch (err) {
    args.logger.error(
      `Callback processing failed: protocolKey=${args.protocolKey} taskId=${providerTaskId} ${errorMessage(err)}`,
    );
  }

  return { received: true };
}
