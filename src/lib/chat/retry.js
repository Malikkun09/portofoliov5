export const DEFAULT_DELAY_MS = 800;

function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function retryOnce(task, { delayMs = DEFAULT_DELAY_MS, sleepFn, shouldRetry } = {}) {
  const first = await task();
  const wantsRetry = shouldRetry ? shouldRetry(first) : Boolean(!first?.ok && first?.retryable);

  if (!wantsRetry) {
    return first;
  }

  const wait = sleepFn || defaultSleep;
  await wait(delayMs);
  return task();
}
