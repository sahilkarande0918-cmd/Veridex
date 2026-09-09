// Tiny TTL memo for network reads that several components ask for at
// the same time (market summary, instrument defaults, profile row).
//
// Two jobs:
//   1. Serve a fresh-enough value from memory instead of refetching.
//   2. De-duplicate concurrent callers — the second caller awaits the
//      first one's in-flight promise rather than starting its own.

type Entry<T> = { at: number; value?: T; inflight?: Promise<T> }

const store = new Map<string, Entry<unknown>>()

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const hit = store.get(key) as Entry<T> | undefined

  if (hit) {
    if (hit.inflight) return hit.inflight                       // join in-flight
    if (hit.value !== undefined && now - hit.at < ttlMs) return hit.value
  }

  const inflight = load()
    .then((value) => { store.set(key, { at: Date.now(), value }); return value })
    .catch((e) => { store.delete(key); throw e })

  store.set(key, { at: now, value: hit?.value, inflight })
  return inflight
}

export function invalidate(prefix?: string) {
  if (!prefix) return store.clear()
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k)
}
