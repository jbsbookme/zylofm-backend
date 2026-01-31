export const env = ((globalThis as unknown) as { process?: { env?: Record<string, string | undefined> } })
  .process?.env ?? {};
