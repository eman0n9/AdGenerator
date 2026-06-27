

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

const PRICING: Record<string, { in: number; out: number }> = {
  "claude-haiku-4-5": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "claude-opus-4-8": { in: 5.0, out: 25.0 },
};

export interface BudgetLimits {

  deadlineMs: number;

  maxCostUsd: number;
}

export const DEFAULT_LIMITS: BudgetLimits = {
  deadlineMs: 30_000,
  maxCostUsd: 0.1,
};

export class Budget {
  readonly startedAt = Date.now();
  tokensIn = 0;
  tokensOut = 0;
  costUsd = 0;

  constructor(private readonly limits: BudgetLimits = DEFAULT_LIMITS) {}

  record(model: string, usage: Usage): void {
    const price = PRICING[model] ?? { in: 0, out: 0 };
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    const billedIn = usage.input_tokens + cacheRead + cacheWrite;

    const inCost =
      (usage.input_tokens * price.in +
        cacheRead * price.in * 0.1 +
        cacheWrite * price.in * 1.25) /
      1_000_000;
    const outCost = (usage.output_tokens * price.out) / 1_000_000;

    this.tokensIn += billedIn;
    this.tokensOut += usage.output_tokens;
    this.costUsd += inCost + outCost;
  }

  elapsedMs(): number {
    return Date.now() - this.startedAt;
  }

  remainingMs(): number {
    return Math.max(0, this.limits.deadlineMs - this.elapsedMs());
  }

  exhausted(): boolean {
    return this.remainingMs() <= 0 || this.costUsd >= this.limits.maxCostUsd;
  }

  async race<T>(work: Promise<T>, label: string): Promise<T> {
    const remaining = this.remainingMs();
    if (remaining <= 0) throw new Error(`budget deadline reached before ${label}`);
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} exceeded ${remaining}ms budget`)),
        remaining,
      );
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
