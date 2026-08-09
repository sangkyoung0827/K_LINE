import "server-only";

export class FinanceJobCapacityError extends Error {
  constructor() {
    super("Finance is at its current analysis capacity. Try again shortly.");
    this.name = "FinanceJobCapacityError";
  }
}

export class FinanceJobTimeoutError extends Error {
  constructor() {
    super("The finance request exceeded its time limit.");
    this.name = "FinanceJobTimeoutError";
  }
}

type FinanceJobContext = { signal: AbortSignal };

const configuredMaxJobs = Number.parseInt(process.env.MAX_FINANCE_JOBS ?? "2", 10);
const configuredTimeoutMs = Number.parseInt(process.env.FINANCE_JOB_TIMEOUT_MS ?? "8000", 10);
const maxJobs = Number.isFinite(configuredMaxJobs) ? Math.min(Math.max(configuredMaxJobs, 1), 4) : 2;
const timeoutMs = Number.isFinite(configuredTimeoutMs) ? Math.min(Math.max(configuredTimeoutMs, 1000), 30000) : 8000;
let activeJobs = 0;

// No worker starts at module load. This guard runs only for an authorized Finance API request.
export async function runBoundedFinanceJob<T>(job: (context: FinanceJobContext) => Promise<T> | T): Promise<T> {
  if (activeJobs >= maxJobs) throw new FinanceJobCapacityError();

  activeJobs += 1;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new FinanceJobTimeoutError());
      }, timeoutMs);
    });

    return await Promise.race([Promise.resolve(job({ signal: controller.signal })), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    activeJobs -= 1;
  }
}

export const financeJobLimits = { maxJobs, timeoutMs };
