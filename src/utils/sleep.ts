export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  const reason = (): Error =>
    signal?.reason instanceof Error
      ? signal.reason
      : new DOMException("Aborted", "AbortError");
  if (signal?.aborted) return Promise.reject(reason());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, ms);
    function done(): void {
      cleanup();
      resolve();
    }
    function aborted(): void {
      cleanup();
      reject(reason());
    }
    function cleanup(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", aborted);
    }
    signal?.addEventListener("abort", aborted, { once: true });
  });
}
