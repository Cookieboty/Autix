'use client';

import { useId } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * 统一的模型厂商映射：按「模型所在厂商」渲染厂商官方品牌图标，而非按单个模型。
 * 新增厂商只需：加一个 Icon + 在 matchVendor 里补关键词 + 在 VENDOR_ICON 登记。
 */
export type ModelVendor = 'google' | 'openai' | 'bytedance' | 'unknown';

/** 厂商识别的输入：可传后端模型对象（provider/name/model/metadata）或直接传名称字符串 */
export interface ModelVendorHint {
  provider?: string | null;
  name?: string | null;
  model?: string | null;
  metadata?: { imageModelKind?: string | null } | null;
}

function matchVendorByText(text: string): ModelVendor {
  const s = text.toLowerCase();
  if (/openai|gpt|dall[-\s]?e/.test(s)) return 'openai';
  if (/google|gemini|nano[-\s]?banana|imagen|veo/.test(s)) return 'google';
  if (/bytedance|seedance|seedream|doubao|jimeng|volc/.test(s)) return 'bytedance';
  return 'unknown';
}

/** 由模型（或名称）解析出所属厂商 */
export function resolveModelVendor(hint: ModelVendorHint | string | null | undefined): ModelVendor {
  if (!hint) return 'unknown';
  if (typeof hint === 'string') return matchVendorByText(hint);
  const kind = hint.metadata?.imageModelKind;
  if (kind === 'gpt-image') return 'openai';
  if (typeof kind === 'string' && kind.startsWith('gemini')) return 'google';
  return matchVendorByText(`${hint.provider ?? ''} ${hint.name ?? ''} ${hint.model ?? ''}`);
}

/* ----------------------------- 厂商官方品牌 SVG ----------------------------- */

const GEMINI_PATH =
  'M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z';

export function GoogleGeminiIcon({ className }: { className?: string }) {
  // 该图标含 3 个渐变，会被多次渲染，id 必须唯一
  const uid = useId();
  const g0 = `${uid}-0`;
  const g1 = `${uid}-1`;
  const g2 = `${uid}-2`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={GEMINI_PATH} fill="#3186FF" />
      <path d={GEMINI_PATH} fill={`url(#${g0})`} />
      <path d={GEMINI_PATH} fill={`url(#${g1})`} />
      <path d={GEMINI_PATH} fill={`url(#${g2})`} />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={g0} x1="7" x2="11" y1="15.5" y2="12">
          <stop stopColor="#08B962" />
          <stop offset="1" stopColor="#08B962" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={g1} x1="8" x2="11.5" y1="5.5" y2="11">
          <stop stopColor="#F94543" />
          <stop offset="1" stopColor="#F94543" stopOpacity="0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={g2} x1="3.5" x2="17.5" y1="13.5" y2="12">
          <stop stopColor="#FABC12" />
          <stop offset=".46" stopColor="#FABC12" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ByteDanceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M14.944 18.587l-1.704-.445V10.01l1.824-.462c1-.254 1.84-.461 1.88-.453.032 0 .056 2.235.056 4.972v4.973l-.176-.008c-.104 0-.952-.207-1.88-.446z"
        fill="#00C8D2"
        fillRule="nonzero"
      />
      <path
        d="M7 16.542c0-2.736.024-4.98.064-4.98.032-.008.872.2 1.88.454l1.816.461-.016 4.05-.024 4.049-1.632.422c-.896.23-1.736.445-1.856.469L7 21.523v-4.98z"
        fill="#3C8CFF"
        fillRule="nonzero"
      />
      <path
        d="M19.24 12.477c0-9.03.008-9.515.144-9.475.072.024.784.207 1.576.406.792.207 1.576.405 1.744.445l.296.08-.016 8.56-.024 8.568-1.624.414c-.888.23-1.728.437-1.856.47l-.24.055v-9.523z"
        fill="#78E6DC"
        fillRule="nonzero"
      />
      <path
        d="M1 12.509c0-4.678.024-8.505.064-8.505.032 0 .872.207 1.872.454l1.824.461v7.582c0 4.16-.016 7.574-.032 7.574-.024 0-.872.215-1.88.47L1 21.013v-8.505z"
        fill="#325AB4"
      />
    </svg>
  );
}

export function OpenAIIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" fillRule="evenodd" aria-hidden="true">
      <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
    </svg>
  );
}

/** 厂商 → 图标 + 额外类名（OpenAI 用 currentColor，需给个前景色） */
const VENDOR_ICON: Record<
  Exclude<ModelVendor, 'unknown'>,
  { Icon: (props: { className?: string }) => React.ReactElement; extraClass?: string }
> = {
  google: { Icon: GoogleGeminiIcon },
  openai: { Icon: OpenAIIcon, extraClass: 'text-foreground' },
  bytedance: { Icon: ByteDanceIcon },
};

/**
 * 按模型所属厂商渲染厂商图标。未知厂商回退到中性图标。
 */
export function ModelVendorIcon({
  model,
  className,
}: {
  model: ModelVendorHint | string | null | undefined;
  className?: string;
}) {
  const vendor = resolveModelVendor(model);
  if (vendor === 'unknown') return <Sparkles className={className} />;
  const { Icon, extraClass } = VENDOR_ICON[vendor];
  return <Icon className={[className, extraClass].filter(Boolean).join(' ')} />;
}
