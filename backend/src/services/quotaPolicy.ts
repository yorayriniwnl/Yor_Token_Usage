export type SubscriptionPeriod = {
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
} | null;

export type QuotaPeriod = {
  start: Date;
  end: Date;
  source: "subscription" | "calendar_month";
};

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addUtcMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const next = new Date(date);
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);

  const daysInTargetMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, daysInTargetMonth));
  return next;
}

export function resolveQuotaPeriod(subscription: SubscriptionPeriod, now: Date): QuotaPeriod {
  const currentPeriodStart = subscription?.currentPeriodStart;
  const currentPeriodEnd = subscription?.currentPeriodEnd;

  if (currentPeriodStart && currentPeriodEnd && currentPeriodStart <= now && currentPeriodEnd > now) {
    return { start: currentPeriodStart, end: currentPeriodEnd, source: "subscription" };
  }

  const start = startOfUtcMonth(now);
  return { start, end: addUtcMonths(start, 1), source: "calendar_month" };
}
