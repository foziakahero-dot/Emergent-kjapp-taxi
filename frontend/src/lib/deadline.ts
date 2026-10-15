/** Bound local/native work too: Axios timeouts start after request interceptors. */
export async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Forespørselen tok for lang tid. Prøv igjen.')), ms);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
