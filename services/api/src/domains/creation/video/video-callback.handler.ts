import { UnauthorizedException } from '@nestjs/common';

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
  if (secret && args.token !== secret) {
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
