export interface InsufficientPointsEvent {
  msg: string;
  code?: string;
  required?: number;
  available?: number;
  url?: string;
  method?: string;
}

export type InsufficientPointsReporter = (event: InsufficientPointsEvent) => void;

let reporter: InsufficientPointsReporter | null = null;

export function registerInsufficientPointsReporter(next: InsufficientPointsReporter | null): void {
  reporter = next;
}

export function reportInsufficientPoints(event: InsufficientPointsEvent): void {
  if (!reporter) return;
  try {
    reporter(event);
  } catch {
    // reporter itself must never break the caller
  }
}

const KEYWORDS: readonly string[] = [
  '积分余额不足',
  '积分不足',
  'insufficient points',
  'insufficient balance',
];

export function matchInsufficientPointsMessage(msg: string | null | undefined): boolean {
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

export function parseInsufficientPointsMessage(msg: string | null | undefined): {
  required: number | null;
  available: number | null;
} {
  if (!msg) return { required: null, available: null };
  const requiredMatch =
    msg.match(/需要\s*(-?\d+(?:\.\d+)?)/) ||
    msg.match(/required[^\d-]*(-?\d+(?:\.\d+)?)/i);
  const availableMatch =
    msg.match(/当前\s*(-?\d+(?:\.\d+)?)/) ||
    msg.match(/available[^\d-]*(-?\d+(?:\.\d+)?)/i);
  const toNum = (m: RegExpMatchArray | null) => {
    if (!m) return null;
    const v = Number(m[1]);
    return Number.isFinite(v) ? v : null;
  };
  return { required: toNum(requiredMatch), available: toNum(availableMatch) };
}
