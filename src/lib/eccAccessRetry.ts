import { SupabaseRequestError } from "@/lib/supabaseServer";

export async function withinEccLookupDeadline<T>(request: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error("ECC lookup timed out");
          error.name = "TimeoutError";
          reject(error);
        }, 4000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function isTemporaryEccLookupError(error: unknown) {
  return error instanceof SupabaseRequestError
    ? [408, 429, 500, 502, 503, 504].includes(error.status)
    : error instanceof TypeError ||
        (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name));
}

export async function retryEccLookup<T>(read: (signal: AbortSignal) => Promise<T>) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read(AbortSignal.timeout(4000));
    } catch (error) {
      if (attempt === 2 || !isTemporaryEccLookupError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}
