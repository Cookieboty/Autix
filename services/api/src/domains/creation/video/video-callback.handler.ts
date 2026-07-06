import { UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

// 常量时间比较（先 sha256 等长化，避免长度侧信道），任一为空即失败。
function secretsMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

type LoggerLike = {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

type ConfigLike = {
  get<T = unknown>(key: string): T | undefined;
};

type GenerationFlowLike = {
  handleCallback(taskId: string, body: Record<string, unknown>): Promise<void>;
};

export async function handleVideoCallbackRequest(args: {
  token?: string;
  body: Record<string, unknown>;
  config: ConfigLike;
  generationFlow: GenerationFlowLike;
  logger: LoggerLike;
}) {
  const secret = args.config.get<string>('VIDEO_CALLBACK_SECRET');
  // fail-closed：未配置密钥时拒绝，避免任何人伪造回调驱动状态机/计费。
  if (!secret) {
    args.logger.error('Rejected video callback: VIDEO_CALLBACK_SECRET not configured');
    throw new UnauthorizedException();
  }
  if (!secretsMatch(args.token, secret)) {
    args.logger.warn('Rejected video callback: invalid or missing token');
    throw new UnauthorizedException();
  }

  const taskId = args.body.id as string | undefined;
  if (!taskId) {
    args.logger.warn('Callback received without task id');
    return { received: true };
  }

  args.logger.log(`Seedance callback received: taskId=${taskId} status=${args.body.status}`);

  try {
    await args.generationFlow.handleCallback(taskId, args.body);
  } catch (err) {
    args.logger.error(
      `Callback processing failed: taskId=${taskId} ${String(err instanceof Error ? err.message : err)}`,
    );
  }

  return { received: true };
}
