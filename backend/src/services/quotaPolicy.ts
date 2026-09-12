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

export interface ProviderWindowPolicy {
  windowType: "rolling" | "daily";
  windowMinutes: number;
  description: string;
}

export interface ProviderWindow {
  provider: string;
  windowType: "rolling" | "daily";
  windowMinutes: number;
  windowStart: Date;
  windowEnd: Date;
  predictedResetAt: Date;
  description: string;
}

export const PROVIDER_WINDOW_POLICIES: Record<string, ProviderWindowPolicy> = {
  chatgpt: {
    windowType: "rolling",
    windowMinutes: 180, // 3-hour rolling window
    description: "ChatGPT 3-hour rolling window"
  },
  claude: {
    windowType: "rolling",
    windowMinutes: 300, // 5-hour rolling window
    description: "Claude 5-hour rolling window"
  },
  gemini: {
    windowType: "daily",
    windowMinutes: 1440,
    description: "Gemini daily request quota"
  },
  perplexity: {
    windowType: "daily",
    windowMinutes: 1440,
    description: "Perplexity daily query quota"
  },
  grok: {
    windowType: "daily",
    windowMinutes: 1440,
    description: "Grok daily query quota"
  },
  deepseek: {
    windowType: "daily",
    windowMinutes: 1440,
    description: "DeepSeek daily quota"
  }
};

export function resolveProviderWindow(provider: string, now: Date, earliestEventInWindow?: Date): ProviderWindow {
  const normProvider = provider.toLowerCase().trim();
  const policy = PROVIDER_WINDOW_POLICIES[normProvider] ?? {
    windowType: "daily",
    windowMinutes: 1440,
    description: "Standard daily quota window"
  };

  if (policy.windowType === "rolling") {
    const windowDurationMs = policy.windowMinutes * 60_000;
    const windowStart = new Date(now.getTime() - windowDurationMs);
    const predictedResetAt = earliestEventInWindow
      ? new Date(earliestEventInWindow.getTime() + windowDurationMs)
      : new Date(now.getTime() + windowDurationMs);

    return {
      provider: normProvider,
      windowType: "rolling",
      windowMinutes: policy.windowMinutes,
      windowStart,
      windowEnd: now,
      predictedResetAt,
      description: policy.description
    };
  }

  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  return {
    provider: normProvider,
    windowType: "daily",
    windowMinutes: 1440,
    windowStart,
    windowEnd,
    predictedResetAt: windowEnd,
    description: policy.description
  };
}

