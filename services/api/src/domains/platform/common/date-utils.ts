/**
 * 按自然月推进日期，月末回退（如 1/31 + 1m = 2/28）。
 */
export function addMonths(from: Date, months: number): Date {
  const date = new Date(from);
  const day = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== day) date.setDate(0);
  return date;
}

export function subtractMonths(from: Date, months: number): Date {
  return addMonths(from, -months);
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

export function addPlanDuration(from: Date, months: number): Date {
  return addMonths(from, Math.max(1, months));
}
