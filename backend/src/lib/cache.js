const MAX_ENTRIES = 5000;
const TTL_MS = 24 * 60 * 60 * 1000;
const store = new Map(); // key -> { value: Promise, expires }

export function cached(key, producer) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  // store the promise, so two simultaneous clicks make only one API call
  const value = producer().catch((err) => {
    store.delete(key); // never cache failures
    throw err;
  });

  if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value); // evict oldest
  store.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}