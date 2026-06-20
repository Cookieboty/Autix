export type VideoGenStatus = 'pending' | 'queued' | 'completed' | 'failed' | 'expired';

export type VideoGenEvent = 'submit' | 'succeed' | 'fail' | 'expire' | 'retry';

const TRANSITIONS: Record<VideoGenStatus, Partial<Record<VideoGenEvent, VideoGenStatus>>> = {
  pending: { submit: 'queued' },
  queued: { succeed: 'completed', fail: 'failed', expire: 'expired' },
  completed: {},
  failed: { retry: 'pending' },
  expired: {},
};

export class InvalidTransitionError extends Error {
  constructor(from: VideoGenStatus, event: VideoGenEvent) {
    super(`Invalid state transition: cannot apply '${event}' to status '${from}'`);
    this.name = 'InvalidTransitionError';
  }
}

export function transition(current: VideoGenStatus, event: VideoGenEvent): VideoGenStatus {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    throw new InvalidTransitionError(current, event);
  }
  return next;
}

export function canTransition(current: VideoGenStatus, event: VideoGenEvent): boolean {
  return TRANSITIONS[current]?.[event] !== undefined;
}

export function isTerminal(status: VideoGenStatus): boolean {
  const events = TRANSITIONS[status];
  return !events || Object.keys(events).length === 0;
}
