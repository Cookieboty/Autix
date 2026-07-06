import { HOT_WEIGHTS } from '@autix/domain';

/**
 * 热度计算纯函数（见 gallery-design.md §9.1）。无副作用、可测试。
 *   rawScore = Σ w_i * signal_i（pv/uv 取 ln(1+x) 抗刷）
 *   decay    = exp(-ln2 * ageHours / halfLifeHours)
 *   boost    = boostScore * boostDecay（加热按自身半衰期回落）
 *   hotScore = rawScore * decay + boost
 */
export interface HotScoreInput {
  uvCount: number;
  pvCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  shareCount: number;
  referenceCount: number;
  citationCount: number;
  /** 资源发布/首次出现至今的小时数 */
  ageHours: number;
  /** 半衰期；默认取广场档（48h），模板等可传 168h */
  halfLifeHours?: number;
  /** 当前生效加热总和（resource_metrics.boostScore） */
  boostScore?: number;
  /** 加热已生效时长（小时），用于 boost 衰减 */
  boostAgeHours?: number;
}

export function computeRawScore(m: HotScoreInput): number {
  const w = HOT_WEIGHTS;
  return (
    w.w_uv * Math.log1p(m.uvCount) +
    w.w_pv * Math.log1p(m.pvCount) +
    w.w_like * m.likeCount +
    w.w_favorite * m.favoriteCount +
    w.w_comment * m.commentCount +
    w.w_share * m.shareCount +
    w.w_reference * m.referenceCount +
    w.w_citation * m.citationCount
  );
}

export function decayFactor(ageHours: number, halfLifeHours: number): number {
  return Math.exp((-Math.LN2 * ageHours) / halfLifeHours);
}

export function computeHotScore(m: HotScoreInput): number {
  const halfLife = m.halfLifeHours ?? HOT_WEIGHTS.halfLifeHours.gallery;
  const raw = computeRawScore(m) * decayFactor(m.ageHours, halfLife);
  const boost =
    m.boostScore && m.boostScore > 0
      ? m.boostScore *
        decayFactor(m.boostAgeHours ?? 0, HOT_WEIGHTS.boostHalfLifeHours)
      : 0;
  return raw + boost;
}
