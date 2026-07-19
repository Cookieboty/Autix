import { countGrowthViolations, evaluateRatchet } from '../check-architecture-boundaries';

test('catches named, opacity, and arbitrary-value colors', () => {
  const c = countGrowthViolations(
    `bg-zinc-900 text-white/60 bg-white/[0.045] border-[#9ee7ff]/24 ` +
    `bg-[#c9ff00]/12 bg-[linear-gradient(0deg,#050606,#0b0b0b)] ` +
    `text-[oklch(0.78_0.09_235)] shadow-[0_0_28px_rgb(201_255_0/38%)]`,
  );
  // 8 个 token，14 次命中：各正则独立求和，方括号任意值与其中的裸 hex 会各计一次。
  expect(c.color).toBe(14);
});

test('size/spacing arbitraries are NOT counted as colors', () => {
  const c = countGrowthViolations('text-[10px] border-[5px] text-[40px] w-[12px] grid-cols-[1fr]');
  expect(c.color).toBe(0);
});

test('detects inline-zh including toLowerCase chain', () => {
  expect(countGrowthViolations(`const isZh = locale.toLowerCase().startsWith('zh');`).inlineZh).toBe(1);
  expect(countGrowthViolations(`return locale.startsWith("zh") ? zh : en;`).inlineZh).toBe(1);
});

test('evaluateRatchet: missing baseline (null) produces a hard-failure violation', () => {
  const violations = evaluateRatchet({ color: 0, inlineZh: 0 }, null, []);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toContain('growth-hotspot-baseline.json');
  expect(violations[0]).toContain('missing or corrupt');
});

test('evaluateRatchet: counts within baseline produce no violations', () => {
  const violations = evaluateRatchet(
    { color: 100, inlineZh: 1 },
    { color: 100, inlineZh: 1 },
    [],
  );
  expect(violations).toHaveLength(0);
});

test('evaluateRatchet: counts over baseline produce a violation listing both metrics', () => {
  const violations = evaluateRatchet(
    { color: 101, inlineZh: 2 },
    { color: 100, inlineZh: 1 },
    ['some/file.tsx (color:101 inlineZh:2)'],
  );
  expect(violations).toHaveLength(1);
  expect(violations[0]).toContain('color: 101 > baseline 100');
  expect(violations[0]).toContain('inlineZh: 2 > baseline 1');
  expect(violations[0]).toContain('some/file.tsx');
});

// Fix 1: bare color-mix counted
test('bare color-mix in style prop is counted in color total', () => {
  const c = countGrowthViolations(
    'background: color-mix(in srgb, var(--growth-accent) 30%, transparent)',
  );
  expect(c.color).toBeGreaterThanOrEqual(1);
});

// Fix 2: structurally-broken baseline (valid JSON, wrong shape) is fail-closed
test('evaluateRatchet: structurally-broken baseline {} is rejected as corrupt', () => {
  const violations = evaluateRatchet({ color: 0, inlineZh: 0 }, {} as unknown as null, []);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toContain('missing or corrupt');
});
